import type { AnnotationPlacement } from "../annotation-placement";
import type { MeasurementTextRange } from "../measurement-text-range";
import type { BoxAdjustment } from "./box-adjustment";
import type { CandidateLine } from "./candidate-line";
import type { CandidateMetrics } from "./japanese-paragraph";
import { JukugoRuby } from "./jukugo-ruby";
import type { MeasurementPiece } from "./measurement-session";
import type { RubyAssociation } from "./ruby-association";
import { RubyBoundary } from "./ruby-boundary";

const EPSILON = 1e-9;

export type RubyLineBase = RubyBoundary & Readonly<{ renderOffsetEm: number; sourceGap: boolean }>;
export type RubyLineSegment = Readonly<{
  association: RubyAssociation;
  start: number;
  end: number;
  pieces: readonly MeasurementPiece[];
}>;
export type PositionedReadingItem = Readonly<{
  value: string;
  textRange: MeasurementTextRange;
  placement: AnnotationPlacement;
}>;
export type RubyLinePlacement = Readonly<{
  segment: RubyLineSegment;
  items: readonly PositionedReadingItem[];
}>;
export type RubyLineLayout = Readonly<{
  line: CandidateLine;
  placements: readonly RubyLinePlacement[];
}>;

function positions(bases: readonly RubyLineBase[], line: CandidateLine) {
  const boxes = new Map(line.boxAdjustments?.map((box) => [box.index, box]));
  const gaps = new Map(line.pairSpacings.map((gap) => [gap.boundary, gap.widthEm]));
  const spaces = new Map(line.characterSpacings.map((space) => [space.index, space.widthEm]));
  const offsets = new Map<number, Readonly<{ offsetEm: number; advanceEm: number }>>();
  let offsetEm = 0;
  for (let index = line.contentStart; index < line.end; index += 1) {
    offsetEm += gaps.get(index) ?? 0;
    const advanceEm =
      index === line.hangingIndex
        ? 0
        : (spaces.get(index) ?? boxes.get(index)?.advanceEm ?? bases[index]?.advanceEm ?? 0);
    offsets.set(index, { offsetEm, advanceEm });
    offsetEm += advanceEm;
  }
  return { offsets, gaps };
}

function allowances(
  bases: readonly RubyLineBase[],
  segment: RubyLineSegment,
  line: CandidateLine,
  gaps: ReadonlyMap<number, number>,
) {
  const first = segment.association.indexes[0] ?? segment.start;
  const last = segment.association.indexes.at(-1) ?? segment.end - 1;
  const jukugo = segment.association.reading.kind === "jukugo";
  return {
    before:
      jukugo && segment.start > first && segment.start > line.contentStart
        ? 0.5
        : RubyBoundary.overhang(
            segment.start > line.contentStart ? bases[segment.start - 1] : undefined,
            "before",
            gaps.get(segment.start) ?? 0,
          ),
    after:
      jukugo && segment.end <= last && segment.end < line.end
        ? 0.5
        : RubyBoundary.overhang(
            segment.end < line.end ? bases[segment.end] : undefined,
            "after",
            gaps.get(segment.end) ?? 0,
          ),
  };
}

function readingAdvance(segment: RubyLineSegment): number {
  return segment.pieces.reduce((sum, piece) => sum + piece.layoutSpan.advanceEm, 0);
}

function place(
  segment: RubyLineSegment,
  baseOffsetEm: number,
  baseAdvanceEm: number,
  before: number,
  after: number,
  resolvedOffsetEm?: number,
): RubyLinePlacement {
  const total = readingAdvance(segment);
  const overhang = total > baseAdvanceEm ? Math.min(total - baseAdvanceEm, before + after) : 0;
  const leading = Math.min(before, overhang / 2 + Math.max(0, overhang / 2 - after));
  const edgeGap =
    total < baseAdvanceEm && segment.pieces.length > 0
      ? (baseAdvanceEm - total) / (2 * segment.pieces.length)
      : 0;
  let offsetEm = resolvedOffsetEm ?? baseOffsetEm - leading + edgeGap;
  const items = segment.pieces.map((piece, index) => {
    const item: PositionedReadingItem = {
      value: piece.value,
      textRange: piece.textRange,
      placement: {
        side: "before",
        inlineSpan: {
          offsetEm: offsetEm + piece.renderSpan.offsetEm - piece.layoutSpan.offsetEm,
          advanceEm: piece.renderSpan.advanceEm,
        },
        blockOffsetEm: -0.5,
        blockSizeEm: 0.5,
      },
    };
    offsetEm += piece.layoutSpan.advanceEm;
    if (index < segment.pieces.length - 1) offsetEm += 2 * edgeGap;
    return item;
  });
  return { segment, items };
}

export const RubyLineLayout = {
  index: (
    segments: readonly RubyLineSegment[],
  ): ReadonlyMap<number, readonly RubyLineSegment[]> => {
    const byStart = new Map<number, RubyLineSegment[]>();
    for (const segment of segments) {
      const sameStart = byStart.get(segment.start);
      if (sameStart === undefined) byStart.set(segment.start, [segment]);
      else sameStart.push(segment);
    }
    return byStart;
  },
  resolve: (
    bases: readonly RubyLineBase[],
    segments: ReadonlyMap<number, readonly RubyLineSegment[]>,
    start: number,
    end: number,
    resolve: (metrics?: CandidateMetrics) => CandidateLine,
    assignedSegments: readonly RubyLineSegment[] = [],
  ): RubyLineLayout | undefined => {
    const selected: RubyLineSegment[] = [];
    for (let index = start; index < end; index += 1)
      for (const segment of segments.get(index) ?? [])
        if (segment.end <= end) selected.push(segment);
    selected.push(...assignedSegments);
    selected.sort((left, right) => left.start - right.start);
    const expansions = new Map<number, number>();
    const extraGaps = new Map<number, number>();
    const metrics = (): CandidateMetrics => {
      const boxAdjustments: BoxAdjustment[] = [];
      for (const [index, extraEm] of expansions) {
        const base = bases[index];
        if (base !== undefined)
          boxAdjustments.push({
            index,
            advanceEm: base.advanceEm + extraEm,
            renderOffsetEm: base.renderOffsetEm + extraEm / 2,
          });
      }
      return {
        boxAdjustments,
        extraSpacings: [...extraGaps].map(([boundary, widthEm]) => ({ boundary, widthEm })),
      };
    };
    let line = resolve();
    // Each pass adds only missing width. The final pass verifies fitting and ink clearance.
    for (let pass = 0; pass <= selected.length * 2 + 2; pass += 1) {
      const { offsets, gaps } = positions(bases, line);
      const placements: RubyLinePlacement[] = [];
      let changed = false;
      for (const segment of selected) {
        const first = offsets.get(segment.start);
        const last = offsets.get(segment.end - 1);
        if (first === undefined || last === undefined) return undefined;
        const span = last.offsetEm + last.advanceEm - first.offsetEm;
        const { before, after } = allowances(bases, segment, line, gaps);
        const missing = readingAdvance(segment) - span - before - after;
        if (missing > EPSILON) {
          const indexes = Array.from(
            { length: segment.end - segment.start },
            (_, index) => segment.start + index,
          ).filter((index) => bases[index]?.sourceGap === false && bases[index].advanceEm > 0);
          if (indexes.length === 0) return undefined;
          for (const index of indexes)
            expansions.set(index, (expansions.get(index) ?? 0) + missing / indexes.length);
          changed = true;
        }
        placements.push(place(segment, first.offsetEm, span, before, after));
      }
      if (changed) {
        line = resolve(metrics());
        continue;
      }
      for (let index = 0; index < selected.length; index += 1) {
        const first = selected[index];
        if (first?.association.reading.kind !== "jukugo") continue;
        const group = [first];
        while (selected[index + group.length]?.association === first.association) {
          const next = selected[index + group.length];
          if (next === undefined) break;
          if (next.start < (group.at(-1)?.end ?? next.start)) return undefined;
          group.push(next);
        }
        const readings = group.flatMap((segment) => {
          const baseStart = offsets.get(segment.start);
          const baseEnd = offsets.get(segment.end - 1);
          if (baseStart === undefined || baseEnd === undefined) return [];
          const baseAdvanceEm = baseEnd.offsetEm + baseEnd.advanceEm - baseStart.offsetEm;
          const total = readingAdvance(segment);
          const edgeGap =
            segment.pieces.length > 0 && total < baseAdvanceEm
              ? (baseAdvanceEm - total) / (2 * segment.pieces.length)
              : 0;
          const limits = allowances(bases, segment, line, gaps);
          return [
            {
              baseOffsetEm: baseStart.offsetEm,
              baseAdvanceEm,
              readingAdvanceEm: total + Math.max(0, segment.pieces.length - 1) * edgeGap * 2,
              beforeEm: limits.before,
              afterEm: limits.after,
            },
          ];
        });
        const result = JukugoRuby.resolve(readings);
        if (result.kind === "needs-spacing") {
          const following = group[result.afterIndex + 1];
          if (following === undefined) return undefined;
          extraGaps.set(following.start, (extraGaps.get(following.start) ?? 0) + result.amountEm);
          changed = true;
        } else {
          for (const [groupIndex, segment] of group.entries()) {
            const reading = readings[groupIndex];
            const offsetEm = result.offsetsEm[groupIndex];
            if (reading === undefined || offsetEm === undefined) return undefined;
            placements[index + groupIndex] = place(
              segment,
              reading.baseOffsetEm,
              reading.baseAdvanceEm,
              reading.beforeEm,
              reading.afterEm,
              offsetEm,
            );
          }
        }
        index += group.length - 1;
      }
      if (changed) {
        line = resolve(metrics());
        continue;
      }
      for (let index = 1; index < placements.length; index += 1) {
        const left = placements[index - 1];
        const right = placements[index];
        const leftItem = left?.items.at(-1);
        const rightItem = right?.items[0];
        if (
          left === undefined ||
          right === undefined ||
          leftItem === undefined ||
          rightItem === undefined
        )
          continue;
        const clearance = right.segment.start > left.segment.end ? 0.5 : 0;
        const missing =
          leftItem.placement.inlineSpan.offsetEm +
          leftItem.placement.inlineSpan.advanceEm +
          clearance -
          rightItem.placement.inlineSpan.offsetEm;
        if (missing <= EPSILON) continue;
        if (right.segment.start < left.segment.end) return undefined;
        extraGaps.set(right.segment.start, (extraGaps.get(right.segment.start) ?? 0) + missing);
        changed = true;
      }
      if (!changed)
        return { line: { ...line, boxAdjustments: metrics().boxAdjustments }, placements };
      line = resolve(metrics());
    }
    return undefined;
  },
} as const;
