import { ManuscriptDiagnostic } from "../diagnostic/manuscript-diagnostic";
import { NamespacedId } from "../namespaced-id";
import { ManuscriptRange } from "../range/manuscript-range";
import { ManuscriptResult } from "../result/manuscript-result";
import { createManuscriptDraft } from "./internal/manuscript-draft";
import { literalEnd, parsePixivTag } from "./internal/pixiv-notation";
import type { ManuscriptParser } from "./manuscript-parser";
import type { ParsedManuscript } from "./parsed-manuscript";

const PARSER_ID = NamespacedId.of("kg/pixiv");

type UnrecognizedSpan = Readonly<{ start: number; end: number }>;

/**
 * Locates an unrecognised source span in display and grapheme coordinates for the warning.
 */
function spanRange(manuscript: ParsedManuscript, span: UnrecognizedSpan): ManuscriptRange {
  const covered = manuscript.graphemes.filter(
    ({ range }) => range.source.start < span.end && range.source.end > span.start,
  );
  const first = covered[0];
  const last = covered.at(-1);
  if (first === undefined || last === undefined) {
    return ManuscriptRange.of({
      source: span,
      display: { start: 0, end: 0 },
      graphemes: { start: 0, end: 0 },
    });
  }

  return ManuscriptRange.of({
    source: span,
    display: { start: first.range.display.start, end: last.range.display.end },
    graphemes: { start: first.range.graphemes.start, end: last.range.graphemes.end },
  });
}

function unrecognizedNotationWarning(
  source: string,
  manuscript: ParsedManuscript,
  span: UnrecognizedSpan,
  index: number,
): ManuscriptDiagnostic {
  return ManuscriptDiagnostic.of({
    source,
    origin: { kind: "parser", id: PARSER_ID },
    severity: "warning",
    code: `unrecognized-notation-${index}`,
    message: "認識できない記法を原文として扱いました",
    range: spanRange(manuscript, span),
  });
}

/**
 * Understands Pixiv's ruby, bold, italic and emphasis-mark notation. Anything bracket-shaped that
 * does not parse is kept as literal text and reported as a warning rather than dropped.
 */
export const pixivParser: ManuscriptParser = {
  id: PARSER_ID,

  parse: (source) => {
    const draft = createManuscriptDraft(source);
    const unrecognized: UnrecognizedSpan[] = [];
    let index = 0;

    while (index < source.length) {
      if (source[index] !== "[") {
        const nextTag = source.indexOf("[", index);
        const end = nextTag === -1 ? source.length : nextTag;
        draft.append(source.slice(index, end), index);
        index = end;
        continue;
      }

      const tag = parsePixivTag(source, index);
      if (tag !== undefined) {
        const range = draft.append(tag.content.text, tag.content.sourceStart);
        draft.annotate({
          ...tag.annotation,
          range: { ...range, source: { start: index, end: tag.end } },
        });
        index = tag.end;
        continue;
      }

      const end = literalEnd(source, index);
      draft.append(source.slice(index, end), index);
      unrecognized.push({ start: index, end });
      index = end;
    }

    const manuscript = draft.build();

    return ManuscriptResult.succeed(
      manuscript,
      unrecognized.map((span, order) =>
        unrecognizedNotationWarning(source, manuscript, span, order),
      ),
    );
  },
};
