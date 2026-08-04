import { ManuscriptDiagnostic } from "../../diagnostic/manuscript-diagnostic";
import type { NamespacedId } from "../../namespaced-id";
import { ManuscriptRange } from "../../range/manuscript-range";
import type { ParsedManuscript } from "../parsed-manuscript";

export type UnrecognizedSpan = Readonly<{ start: number; end: number }>;

function firstCoveredIndex(manuscript: ParsedManuscript, start: number): number {
  let low = 0;
  let high = manuscript.graphemes.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const grapheme = manuscript.graphemes[middle];
    if (grapheme === undefined) return manuscript.graphemes.length;
    if (grapheme.range.source.end <= start) low = middle + 1;
    else high = middle;
  }
  return low;
}

function lastCoveredIndex(manuscript: ParsedManuscript, end: number): number {
  let low = 0;
  let high = manuscript.graphemes.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const grapheme = manuscript.graphemes[middle];
    if (grapheme === undefined) return -1;
    if (grapheme.range.source.start < end) low = middle + 1;
    else high = middle;
  }
  return low - 1;
}

function spanRange(manuscript: ParsedManuscript, span: UnrecognizedSpan): ManuscriptRange {
  const first = manuscript.graphemes[firstCoveredIndex(manuscript, span.start)];
  const last = manuscript.graphemes[lastCoveredIndex(manuscript, span.end)];
  if (
    first === undefined ||
    last === undefined ||
    first.range.source.start >= span.end ||
    last.range.source.end <= span.start
  ) {
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

export function unrecognizedNotationWarnings(
  source: string,
  parserId: NamespacedId,
  manuscript: ParsedManuscript,
  spans: readonly UnrecognizedSpan[],
): readonly ManuscriptDiagnostic[] {
  return spans.map((span, order) =>
    ManuscriptDiagnostic.of({
      source,
      origin: { kind: "parser", id: parserId },
      severity: "warning",
      code: `unrecognized-notation-${order}`,
      message: "認識できない記法を原文として扱いました",
      range: spanRange(manuscript, span),
    }),
  );
}
