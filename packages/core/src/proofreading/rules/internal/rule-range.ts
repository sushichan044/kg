import type { ParsedManuscript } from "../../../parser/parsed-manuscript";
import { ManuscriptRange } from "../../../range/manuscript-range";
import type { TextRange } from "../../../range/text-range";

const EMPTY_BOUNDS = { start: 0, end: 0 } as const;

/**
 * Turns a span of display text into a full range. The source span is the smallest contiguous run
 * that covers the display span, so it includes any notation the parser removed in between.
 */
export function displayRange(
  manuscript: ParsedManuscript,
  start: number,
  end: number,
): ManuscriptRange {
  const covered = manuscript.graphemes.filter(
    ({ range }) => range.display.start < end && range.display.end > start,
  );
  const first = covered[0];
  const last = covered.at(-1);
  if (first === undefined || last === undefined) {
    return ManuscriptRange.of({
      source: EMPTY_BOUNDS,
      display: { start, end },
      graphemes: EMPTY_BOUNDS,
    });
  }

  const merged = ManuscriptRange.merge(covered.map(({ range }) => range));
  return ManuscriptRange.of({
    source: {
      start: first.range.source.start + clampWithin(start - first.range.display.start, first.range),
      end:
        end === last.range.display.end
          ? last.range.source.end
          : last.range.source.start + clampWithin(end - last.range.display.start, last.range),
    },
    display: { start, end },
    graphemes: merged?.graphemes ?? EMPTY_BOUNDS,
  });
}

/**
 * A display offset inside a grapheme cannot map past that grapheme's own source span.
 */
function clampWithin(offset: number, range: Readonly<{ source: TextRange }>): number {
  return Math.min(offset, range.source.end - range.source.start);
}

/**
 * Turns a span of source text into a full range, for rules that inspect the raw source.
 */
export function sourceRange(manuscript: ParsedManuscript, source: TextRange): ManuscriptRange {
  const covered = manuscript.graphemes.filter(
    ({ range }) => range.source.start < source.end && range.source.end > source.start,
  );
  const enclosing = manuscript.annotations.find(
    ({ range }) => range.source.start <= source.start && range.source.end >= source.end,
  );
  const merged =
    ManuscriptRange.merge(covered.map(({ range }) => range)) ?? enclosing?.range ?? null;

  return ManuscriptRange.of({
    source,
    display: merged?.display ?? EMPTY_BOUNDS,
    graphemes: merged?.graphemes ?? EMPTY_BOUNDS,
  });
}
