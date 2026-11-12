import * as v from "valibot";

import { graphemeSegmenter } from "../../internal/segmenter";
import type { ManuscriptAnnotation } from "../annotation/manuscript-annotation";
import type { ParsedGrapheme } from "../parsed-grapheme";
import { ParsedManuscript } from "../parsed-manuscript";

/**
 * ドラフトはスキーマの_入力_型である。DTO と同じ形だが、可変でブランドが付かない。
 * パーサーがその場で値を伸ばしていき、`build` が一度のパースで木全体にブランドを付けられる。
 */
type GraphemeDraft = v.InferInput<typeof ParsedGrapheme.schema>;
type AnnotationDraft = v.InferInput<typeof ManuscriptAnnotation.schema>;
type RangeDraft = GraphemeDraft["range"];

type ManuscriptDraft = Readonly<{
  /**
   * `sourceStart` に由来する表示用テキストを追加し、それが占める範囲を返す。
   */
  append: (text: string, sourceStart: number) => RangeDraft;
  annotate: (annotation: AnnotationDraft) => void;
  build: () => ParsedManuscript;
}>;

/**
 * 別々の呼び出しで追加したテキストが、1 つの書記素になることもある（基底文字に結合文字が続く
 * 場合など）。その場合は、後ろの部分を直前の書記素に畳み込む。
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
