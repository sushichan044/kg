import { AdjustmentUnit } from "./adjustment-unit";
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
  // 前後のアキにまたがる調整箇所（straddle）は候補行1行の行末一つにしか現れないので、
  // その管理はプロファイルが実際に報告した場合にだけ作る。それ以外の行は2つ目のループだけを通る。
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
    // 3.1.9 は二つを一体として扱う。前のアキを詰められないなら、どちらも詰めない。
    if (availableEm + EPSILON >= straddle.absorbsPrecedingEm) {
      absorbedBoundary = precedingBoundary;
      absorbedEm = straddle.absorbsPrecedingEm;
      units.push(
        AdjustmentUnit.of(adjustment, straddleOwn, [
          { slot: { kind: "gap", boundary: precedingBoundary }, capacityEm: absorbedEm },
          { slot: straddleSlot, capacityEm: straddleOwn.amountEm },
        ]),
      );
    }
  }

  for (const { slot, spacing } of values) {
    if (slot.kind === "gap" && slot.boundary === absorbingBoundary) continue;
    const own = select(spacing);
    if (own === undefined) continue;
    const claimedEm = slot.kind === "gap" && slot.boundary === absorbedBoundary ? absorbedEm : 0;
    const amountEm = own.amountEm - claimedEm;
    if (amountEm <= EPSILON) continue;
    units.push(AdjustmentUnit.of(adjustment, own, [{ slot, capacityEm: amountEm }]));
  }

  return units;
}
