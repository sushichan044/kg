import * as v from "valibot";

import { graphemeSegmenter } from "../../internal/segmenter";
import type { ManuscriptAnnotation } from "../annotation/manuscript-annotation";
import type { ParsedGrapheme } from "../parsed-grapheme";
import { ParsedManuscript } from "../parsed-manuscript";

/**
 * Drafts are the schemas' _input_ types: the same shape as the DTOs but mutable and unbranded, so a
 * parser can grow them in place and let `build` brand the whole tree in one parse.
 */
type GraphemeDraft = v.InferInput<typeof ParsedGrapheme.schema>;
type AnnotationDraft = v.InferInput<typeof ManuscriptAnnotation.schema>;
export type RangeDraft = GraphemeDraft["range"];

export type ManuscriptDraft = Readonly<{
  /**
   * Appends display text that came from `sourceStart`, returning the range it now occupies.
   */
  append: (text: string, sourceStart: number) => RangeDraft;
  annotate: (annotation: AnnotationDraft) => void;
  build: () => ParsedManuscript;
}>;

/**
 * Text appended in separate calls can still form one grapheme (a base character followed by a
 * combining mark). When that happens the trailing part is folded into the previous grapheme.
 */
function joinedPrefixLength(previous: string, text: string): number {
  const [first] = graphemeSegmenter.segment(previous + text);
  return (first?.segment.length ?? previous.length) - previous.length;
}

export function createManuscriptDraft(source: string): ManuscriptDraft {
  const displayParts: string[] = [];
  const graphemes: GraphemeDraft[] = [];
  const annotations: AnnotationDraft[] = [];
  let displayLength = 0;

  const append = (text: string, sourceStart: number): RangeDraft => {
    const displayStart = displayLength;
    let graphemeStart = graphemes.length;
    let unsegmentedStart = 0;
    displayParts.push(text);

    const previous = graphemes.at(-1);
    if (previous !== undefined && text.length > 0) {
      unsegmentedStart = joinedPrefixLength(previous.value, text);
      if (unsegmentedStart > 0) {
        previous.value += text.slice(0, unsegmentedStart);
        previous.range.display.end += unsegmentedStart;
        previous.range.source.end = sourceStart + unsegmentedStart;
        graphemeStart -= 1;
      }
    }

    for (const { index, segment } of graphemeSegmenter.segment(text.slice(unsegmentedStart))) {
      const offset = unsegmentedStart + index;
      const graphemeIndex = graphemes.length;
      graphemes.push({
        value: segment,
        range: {
          source: { start: sourceStart + offset, end: sourceStart + offset + segment.length },
          display: { start: displayStart + offset, end: displayStart + offset + segment.length },
          graphemes: { start: graphemeIndex, end: graphemeIndex + 1 },
        },
      });
    }
    displayLength += text.length;

    return {
      source: { start: sourceStart, end: sourceStart + text.length },
      display: { start: displayStart, end: displayLength },
      graphemes: { start: Math.max(0, graphemeStart), end: graphemes.length },
    };
  };

  return {
    append,

    annotate: (annotation) => {
      annotations.push(annotation);
    },

    build: () =>
      v.parse(ParsedManuscript.schema, {
        source,
        displayText: displayParts.join(""),
        graphemes,
        annotations,
      }),
  };
}
