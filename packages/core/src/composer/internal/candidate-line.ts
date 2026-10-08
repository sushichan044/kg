import { AdjustmentUnit } from "./adjustment-unit";
import type { FinalExpansion } from "./final-expansion";
import type { ParagraphLinePlan } from "./paragraph-line-plan";
import { hangingSpacings, naturalSpacings, resolveSpacings } from "./spacing-allocation";
import type { SpacingOpportunity } from "./spacing-opportunity";

const EPSILON = 1e-9;

export type CandidateLine = ParagraphLinePlan &
  Readonly<{ deformationRatio: number; deformationCost: number }>;
export type CandidateLineContext = Readonly<{
  start: number;
  contentStart: number;
  end: number;
  suppressedIndexes: readonly number[];
  boxesSizeEm: number;
  terminal: boolean;
  lastVisible: number | undefined;
  lastAdvance: number;
  canHang: boolean;
  pairValues: readonly SpacingOpportunity[];
  unitsFor: (direction: AdjustmentUnit["direction"]) => readonly AdjustmentUnit[];
  finalExpansion: FinalExpansion;
}>;

export const CandidateLine = {
  resolve: (context: CandidateLineContext, lineLengthEm: number): CandidateLine => {
    const {
      start,
      contentStart,
      end,
      suppressedIndexes,
      boxesSizeEm,
      terminal,
      lastVisible,
      lastAdvance,
      canHang,
      pairValues,
      unitsFor,
      finalExpansion,
    } = context;
    const naturalSizeEm =
      boxesSizeEm + pairValues.reduce((total, value) => total + value.spacing.naturalWidthEm, 0);
    const overflow = naturalSizeEm - lineLengthEm;
    const underflow = lineLengthEm - naturalSizeEm;
    // A line is either over or under, so only one direction's units is ever wanted. Building both
    // would double the work of the inner loop of the paragraph optimizer for nothing.
    const units = unitsFor(overflow > 0 ? "shrink" : "stretch");
    // Coupled units own their complete capacity and cost, including parts taken from other slots.
    const capacity = units.reduce((total, unit) => total + AdjustmentUnit.capacity(unit), 0);
    const freeShrinkCapacity = units.reduce(
      (total, unit) => total + (unit.costPerEm === 0 ? AdjustmentUnit.capacity(unit) : 0),
      0,
    );
    const trailingSpacing =
      pairValues.find(({ slot }) => slot.kind === "gap" && slot.boundary === end)?.spacing
        .naturalWidthEm ?? 0;
    const hasFinalStretch = finalExpansion.slots.length > 0;

    if (terminal && overflow <= EPSILON) {
      return {
        start,
        contentStart,
        end,
        suppressedIndexes,
        ...naturalSpacings(pairValues),
        inlineSizeEm: naturalSizeEm,
        break: { kind: "paragraph-end" },
        hangingIndex: null,
        deformationRatio: 0,
        deformationCost: 0,
      };
    }

    if (Math.abs(overflow) <= EPSILON) {
      return {
        start,
        contentStart,
        end,
        suppressedIndexes,
        ...naturalSpacings(pairValues),
        inlineSizeEm: naturalSizeEm,
        break: { kind: "natural" },
        hangingIndex: null,
        deformationRatio: 0,
        deformationCost: 0,
      };
    }

    // Discrete units can leave a remainder even when the total capacity exceeds the overflow.
    const shrunk =
      overflow > 0 && overflow <= capacity + EPSILON
        ? resolveSpacings(pairValues, units, "shrink", overflow, finalExpansion)
        : null;

    if (shrunk !== null && shrunk.unabsorbedEm <= EPSILON) {
      const chargeableCapacity = capacity - freeShrinkCapacity;
      const chargeableShrink = Math.max(0, overflow - shrunk.freeEm);
      return {
        start,
        contentStart,
        end,
        suppressedIndexes,
        ...shrunk.spacings,
        inlineSizeEm: lineLengthEm,
        break: { kind: "shrunk" },
        hangingIndex: null,
        deformationRatio: chargeableCapacity <= EPSILON ? 0 : chargeableShrink / chargeableCapacity,
        deformationCost: shrunk.deformationCost,
      };
    }

    if (
      !terminal &&
      overflow > 0 &&
      lastVisible !== undefined &&
      canHang &&
      naturalSizeEm - lastAdvance - trailingSpacing <= lineLengthEm + EPSILON
    ) {
      return {
        start,
        contentStart,
        end,
        suppressedIndexes,
        ...hangingSpacings(pairValues, end),
        inlineSizeEm: naturalSizeEm - lastAdvance - trailingSpacing,
        break: { kind: "hanging" },
        hangingIndex: lastVisible,
        deformationRatio: overflow / Math.max(lastAdvance, EPSILON),
        deformationCost: 0,
      };
    }

    // Final expansion spends the remainder only on the separately resolved eligible slots.
    const stretched =
      !terminal && underflow > EPSILON && (underflow <= capacity + EPSILON || hasFinalStretch)
        ? resolveSpacings(pairValues, units, "stretch", underflow, finalExpansion)
        : null;

    if (stretched !== null && stretched.unabsorbedEm <= EPSILON) {
      return {
        start,
        contentStart,
        end,
        suppressedIndexes,
        ...stretched.spacings,
        inlineSizeEm: lineLengthEm,
        break: { kind: "stretched" },
        hangingIndex: null,
        deformationRatio:
          stretched.finalStretchPerSlotEm > 0
            ? 1 + stretched.finalStretchPerSlotEm
            : capacity === 0
              ? 0
              : underflow / capacity,
        deformationCost: stretched.deformationCost,
      };
    }

    return {
      start,
      contentStart,
      end,
      suppressedIndexes,
      ...naturalSpacings(pairValues),
      inlineSizeEm: naturalSizeEm,
      break: { kind: "forced" },
      hangingIndex: null,
      deformationRatio: Math.abs(naturalSizeEm - lineLengthEm) / Math.max(lineLengthEm, EPSILON),
      deformationCost: 0,
    };
  },
} as const;
