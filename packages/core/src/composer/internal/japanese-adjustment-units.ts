import type { AdjustmentUnit } from "./adjustment-unit";
import type { SpacingCapacity } from "./spacing";
import type { PairSpacing } from "./spacing";
import type { SpacingOpportunity } from "./spacing-opportunity";

const EPSILON = 1e-9;
export type JapaneseSpacingOpportunity = SpacingOpportunity &
  Readonly<{ absorbsPrecedingEm: number }>;

export function adjustmentUnits(
  values: readonly JapaneseSpacingOpportunity[],
  adjustment: "shrink" | "stretch",
): AdjustmentUnit[] {
  const select = (spacing: PairSpacing): SpacingCapacity | undefined =>
    adjustment === "shrink" ? spacing.shrink : spacing.stretch;
  const units: AdjustmentUnit[] = [];
  // A straddle is one line end of one candidate line, so the bookkeeping for it is built only where
  // the profile actually reports one. Every other line takes the second loop alone.
  const straddle = values.find(({ absorbsPrecedingEm }) => absorbsPrecedingEm > 0);
  let absorbedBoundary: number | undefined;
  let absorbedEm = 0;
  let absorbingBoundary: number | undefined;

  const straddleSlot = straddle?.slot.kind === "gap" ? straddle.slot : undefined;
  const straddleOwn = straddle === undefined ? undefined : select(straddle.spacing);

  if (straddle !== undefined && straddleSlot !== undefined && straddleOwn !== undefined) {
    const precedingBoundary = straddleSlot.boundary - 1;
    const preceding = values.find(
      ({ slot }) => slot.kind === "gap" && slot.boundary === precedingBoundary,
    );
    const availableEm = preceding === undefined ? 0 : (select(preceding.spacing)?.amountEm ?? 0);
    absorbingBoundary = straddleSlot.boundary;
    // 3.1.9 takes the two together: where the space before cannot give, neither goes.
    if (availableEm + EPSILON >= straddle.absorbsPrecedingEm) {
      absorbedBoundary = precedingBoundary;
      absorbedEm = straddle.absorbsPrecedingEm;
      units.push({
        parts: [
          { slot: { kind: "gap", boundary: precedingBoundary }, capacityEm: absorbedEm },
          { slot: straddleSlot, capacityEm: straddleOwn.amountEm },
        ],
        direction: adjustment,
        kind: straddleOwn.granularity,
        stage: straddleOwn.stage,
        costPerEm: straddleOwn.costPerEm,
      });
    }
  }

  for (const { slot, spacing } of values) {
    if (slot.kind === "gap" && slot.boundary === absorbingBoundary) continue;
    const own = select(spacing);
    if (own === undefined) continue;
    const claimedEm = slot.kind === "gap" && slot.boundary === absorbedBoundary ? absorbedEm : 0;
    const amountEm = own.amountEm - claimedEm;
    if (amountEm <= EPSILON) continue;
    units.push({
      parts: [{ slot, capacityEm: amountEm }],
      direction: adjustment,
      kind: own.granularity,
      stage: own.stage,
      costPerEm: own.costPerEm,
    });
  }

  return units;
}
