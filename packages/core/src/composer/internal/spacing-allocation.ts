import { AdjustmentUnit } from "./adjustment-unit";
import type { FinalExpansion } from "./final-expansion";
import type { ResolvedPairSpacing, ResolvedCharacterSpacing } from "./paragraph-line-plan";
import type { PairSpacing } from "./spacing";
import type { SpacingOpportunity } from "./spacing-opportunity";
import { SpacingSlot } from "./spacing-slot";

const EPSILON = 1e-9;

export function resolveSpacings(
  values: readonly SpacingOpportunity[],
  units: readonly AdjustmentUnit[],
  adjustment: "shrink" | "stretch",
  amountEm: number,
  finalExpansion: FinalExpansion,
): Readonly<{
  spacings: ResolvedSpacings;
  deformationCost: number;
  freeEm: number;
  finalStretchPerSlotEm: number;
  unabsorbedEm: number;
}> {
  const usedBySlot = new Map<number, number>();
  let remaining = amountEm;
  let deformationCost = 0;
  let freeEm = 0;
  let finalStretchPerSlotEm = 0;

  const spend = (unit: AdjustmentUnit, fraction: number): void => {
    for (const { slot, capacityEm: partEm } of unit.parts) {
      const key = SpacingSlot.key(slot);
      usedBySlot.set(key, (usedBySlot.get(key) ?? 0) + partEm * fraction);
    }
    const spentEm = AdjustmentUnit.capacity(unit) * fraction;
    deformationCost += spentEm * unit.costPerEm;
    if (unit.costPerEm === 0) freeEm += spentEm;
    remaining -= spentEm;
  };

  const stages = new Map<number, AdjustmentUnit[]>();
  for (const unit of units) {
    if (unit.direction !== adjustment) continue;
    const stage = stages.get(unit.stage);
    if (stage === undefined) stages.set(unit.stage, [unit]);
    else stage.push(unit);
  }

  for (const stageIndex of [...stages.keys()].sort((left, right) => left - right)) {
    if (remaining <= EPSILON) break;
    const stage = stages.get(stageIndex) ?? [];
    let stageCapacityEm = 0;

    for (const unit of stage) {
      if (unit.kind === "continuous") stageCapacityEm += AdjustmentUnit.capacity(unit);
      else if (AdjustmentUnit.capacity(unit) <= remaining + EPSILON) spend(unit, 1);
    }

    if (stageCapacityEm <= EPSILON || remaining <= EPSILON) continue;
    const fraction = Math.min(remaining, stageCapacityEm) / stageCapacityEm;
    for (const unit of stage) {
      if (unit.kind === "continuous") spend(unit, fraction);
    }
  }

  if (adjustment === "stretch" && remaining > EPSILON) {
    const finalSlotCount = finalExpansion.slots.length;
    if (finalSlotCount > 0) {
      finalStretchPerSlotEm = remaining / finalSlotCount;
      for (const slot of finalExpansion.slots) {
        const key = SpacingSlot.key(slot);
        usedBySlot.set(key, (usedBySlot.get(key) ?? 0) + finalStretchPerSlotEm);
      }
      deformationCost += remaining * finalExpansion.costPerEm;
      remaining = 0;
    }
  }

  return {
    spacings: splitBySlot(values, (slot, spacing) => {
      const used = usedBySlot.get(SpacingSlot.key(slot)) ?? 0;
      return adjustment === "shrink"
        ? spacing.naturalWidthEm - used
        : spacing.naturalWidthEm + used;
    }),
    deformationCost,
    freeEm,
    finalStretchPerSlotEm,
    unabsorbedEm: Math.max(0, remaining),
  };
}

export type ResolvedSpacings = Readonly<{
  pairSpacings: ResolvedPairSpacing[];
  characterSpacings: ResolvedCharacterSpacing[];
}>;

function splitBySlot(
  values: readonly SpacingOpportunity[],
  widthOf: (slot: SpacingSlot, spacing: PairSpacing) => number,
): ResolvedSpacings {
  const pairSpacings: ResolvedPairSpacing[] = [];
  const characterSpacings: ResolvedCharacterSpacing[] = [];
  for (const { slot, spacing } of values) {
    const resolved = {
      kind: spacing.kind,
      naturalWidthEm: spacing.naturalWidthEm,
      widthEm: widthOf(slot, spacing),
    };
    if (slot.kind === "gap") pairSpacings.push({ boundary: slot.boundary, ...resolved });
    else characterSpacings.push({ index: slot.index, ...resolved });
  }
  return { pairSpacings, characterSpacings };
}

/**
 * The same spaces at their resolved natural width, for a line no adjustment reaches.
 */
export function naturalSpacings(values: readonly SpacingOpportunity[]): ResolvedSpacings {
  return splitBySlot(values, (_slot, spacing) => spacing.naturalWidthEm);
}

/**
 * The same, minus the アキ the line end would have taken: a hanging character sits outside the text
 * area and the space that would have followed it goes with it.
 */
export function hangingSpacings(
  values: readonly SpacingOpportunity[],
  end: number,
): ResolvedSpacings {
  const { pairSpacings, characterSpacings } = naturalSpacings(values);
  return {
    pairSpacings: pairSpacings.filter(({ boundary }) => boundary !== end),
    characterSpacings,
  };
}
