import type { GridCell } from "../grid-cell";
import type { KinsokuSettings } from "../kinsoku-settings";

// Copied verbatim from issue #60. Every character here is a single BMP code point, so a Set built
// from the source string (whose default iterator yields one entry per code point) matches a
// GridCell's already grapheme-segmented value exactly — no surrogate-pair or combining-mark
// handling is needed on either side.
const 行頭禁則文字 = new Set(
  "!),.:;?]}¢—’”‰℃℉、。々〉》」』】〕〟ぁぃぅぇぉっゃゅょゎ゛゜ゝゞァィゥェォッャュョヮヵヶ・ーヽヾ！％），．：；？］｝",
);
const 行末禁則文字 = new Set("([{£§‘“〈《「『【〒〔〝＃＄（＠［｛￥");
const ぶら下がり文字 = new Set("、。，．");
const 分離禁止文字 = new Set("—‥…");

function valueOf(cell: GridCell | undefined): string | null {
  return cell?.value ?? null;
}

function isLineStartProhibited(value: string | null): boolean {
  return value !== null && 行頭禁則文字.has(value);
}

function isLineEndProhibited(value: string | null): boolean {
  return value !== null && 行末禁則文字.has(value);
}

function isHanging(value: string | null): boolean {
  return value !== null && ぶら下がり文字.has(value);
}

function isInseparable(value: string | null): boolean {
  return value !== null && 分離禁止文字.has(value);
}

/**
 * The start of the run matching `predicate` that ends right before `before`. Stops at `floor`
 * rather than the start of `cells`, since a run is not allowed to reach back into a line that is
 * already settled.
 */
function backwardRunStart(
  cells: readonly GridCell[],
  before: number,
  floor: number,
  predicate: (value: string | null) => boolean,
): number {
  let start = before;
  while (start > floor && predicate(valueOf(cells[start - 1]))) start -= 1;
  return start;
}

/**
 * The end of the run matching `predicate` that begins at `from`.
 */
function forwardRunEnd(
  cells: readonly GridCell[],
  from: number,
  predicate: (value: string | null) => boolean,
): number {
  let end = from;
  while (end < cells.length && predicate(valueOf(cells[end]))) end += 1;
  return end;
}

export type LineBreak = Readonly<{
  /**
   * One past the last cell the line keeps; `cells.slice(index, end)` is its content.
   */
  end: number;
  /**
   * Leading punctuation from the next line that hangs off this one instead of occupying a cell on
   * either line.
   */
  hanging: readonly GridCell[];
}>;

/**
 * Moves a wrap boundary earlier so it neither splits a non-separable run nor lands on a
 * line-end-prohibited character, and resolves what would otherwise be a line-start-prohibited head
 * of the next line by hanging leading punctuation or, failing that, pushing one more character
 * across. Only meaningful at a wrap boundary — a source line's own end is never adjusted.
 *
 * `end` decreases monotonically and never drops below `index + 1`, so a line keeps at least one
 * cell even when every candidate character is itself prohibited.
 */
export function resolveLineBreak(
  cells: readonly GridCell[],
  index: number,
  tentativeEnd: number,
  kinsoku: KinsokuSettings,
): LineBreak {
  let end = tentativeEnd;

  for (;;) {
    const before = end;

    if (isInseparable(valueOf(cells[end - 1])) && isInseparable(valueOf(cells[end]))) {
      const runStart = backwardRunStart(cells, end, index, isInseparable);
      if (runStart > index) end = runStart;
    }

    while (end > index + 1 && isLineEndProhibited(valueOf(cells[end - 1]))) {
      end -= 1;
    }

    const hangingRunEnd = kinsoku.hangingPunctuation ? forwardRunEnd(cells, end, isHanging) : end;
    if (end > index + 1 && isLineStartProhibited(valueOf(cells[hangingRunEnd]))) {
      end -= 1;
    }

    if (end === before) break;
  }

  const hangingEnd = kinsoku.hangingPunctuation ? forwardRunEnd(cells, end, isHanging) : end;
  return { end, hanging: cells.slice(end, hangingEnd) };
}
