import type { SpacingSlot } from "./spacing-slot";

export type FinalExpansion = Readonly<{ slots: readonly SpacingSlot[]; costPerEm: number }>;
