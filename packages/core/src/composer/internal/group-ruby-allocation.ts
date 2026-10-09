import { graphemeSegmenter } from "../../internal/segmenter";
import { MeasurementTextRange } from "../measurement-text-range";
import type { MeasurementPiece } from "./measurement-session";
import type { RubyAssociation } from "./ruby-association";
import type { RubyLineSegment } from "./ruby-line-layout";

export type GroupRubyAllocation = Readonly<{
  association: RubyAssociation;
  start: number;
  end: number;
  pieces: readonly MeasurementPiece[];
  basePrefixEm: readonly number[];
  readingPrefixGraphemes: readonly number[];
}>;

function nearestBoundary(prefix: readonly number[], target: number): number {
  let low = 0;
  let high = prefix.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((prefix[middle] ?? 0) < target) low = middle + 1;
    else high = middle;
  }
  return low > 0 && target - (prefix[low - 1] ?? 0) < (prefix[low] ?? 0) - target ? low - 1 : low;
}

export const GroupRubyAllocation = {
  prepare: (
    association: RubyAssociation,
    pieces: readonly MeasurementPiece[],
    advancesEm: readonly number[],
  ): GroupRubyAllocation | undefined => {
    const start = association.indexes[0];
    const last = association.indexes.at(-1);
    if (start === undefined || last === undefined) return undefined;
    const basePrefixEm = [0];
    for (const index of association.indexes)
      basePrefixEm.push((basePrefixEm.at(-1) ?? 0) + (advancesEm[index] ?? 0));
    const readingPrefixGraphemes = [0];
    for (const piece of pieces)
      readingPrefixGraphemes.push(
        (readingPrefixGraphemes.at(-1) ?? 0) + [...graphemeSegmenter.segment(piece.value)].length,
      );
    return { association, start, end: last + 1, pieces, basePrefixEm, readingPrefixGraphemes };
  },
  assign: (
    group: GroupRubyAllocation,
    start: number,
    end: number,
    cursor: number,
    lineLengthEm: number,
  ): Readonly<{ segment: RubyLineSegment; nextCursor: number }> => {
    const fragmentStart = Math.max(start, group.start);
    const fragmentEnd = Math.min(end, group.end);
    const readingStart = start <= group.start ? 0 : cursor;
    const totalBase = group.basePrefixEm.at(-1) ?? 0;
    const consumedBase = group.basePrefixEm[fragmentEnd - group.start] ?? totalBase;
    const baseFraction =
      totalBase > 0
        ? consumedBase / totalBase
        : (fragmentEnd - group.start) / (group.end - group.start);
    const target = Math.round(baseFraction * (group.readingPrefixGraphemes.at(-1) ?? 0));
    let readingEnd = nearestBoundary(group.readingPrefixGraphemes, target);
    if (fragmentEnd === group.end) readingEnd = group.pieces.length;
    else {
      const remainingFragments = Math.max(1, Math.ceil((totalBase - consumedBase) / lineLengthEm));
      const reserve = group.pieces.length - readingStart >= remainingFragments + 1;
      const minimum = reserve ? readingStart + 1 : readingStart;
      const maximum = reserve ? group.pieces.length - remainingFragments : group.pieces.length;
      readingEnd = Math.max(minimum, Math.min(maximum, readingEnd));
    }
    const selected = group.pieces.slice(readingStart, readingEnd);
    const textStart = selected[0]?.textRange.start ?? 0;
    const layoutStart = selected[0]?.layoutSpan.offsetEm ?? 0;
    const pieces = selected.map((piece) => ({
      value: piece.value,
      textRange: MeasurementTextRange.of({
        start: piece.textRange.start - textStart,
        end: piece.textRange.end - textStart,
      }),
      layoutSpan: {
        advanceEm: piece.layoutSpan.advanceEm,
        offsetEm: piece.layoutSpan.offsetEm - layoutStart,
      },
      renderSpan: {
        advanceEm: piece.renderSpan.advanceEm,
        offsetEm: piece.renderSpan.offsetEm - layoutStart,
      },
    }));
    return {
      segment: { association: group.association, start: fragmentStart, end: fragmentEnd, pieces },
      nextCursor: fragmentEnd === group.end ? 0 : readingEnd,
    };
  },
} as const;
