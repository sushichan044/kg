import type { SpacingCapacity } from "./spacing";
import type { SpacingSlot } from "./spacing-slot";

export type AdjustmentUnit = Readonly<{
  direction: "shrink" | "stretch";
  kind: "continuous" | "all-or-nothing";
  stage: number;
  costPerEm: number;
  parts: ReadonlyArray<Readonly<{ slot: SpacingSlot; capacityEm: number }>>;
}>;

export const AdjustmentUnit = {
  capacity: (unit: AdjustmentUnit): number =>
    unit.parts.reduce((total, part) => total + part.capacityEm, 0),
  of: (
    direction: AdjustmentUnit["direction"],
    capacity: SpacingCapacity,
    parts: AdjustmentUnit["parts"],
  ): AdjustmentUnit => ({
    direction,
    kind: capacity.granularity,
    stage: capacity.stage,
    costPerEm: capacity.costPerEm,
    parts,
  }),
} as const;
