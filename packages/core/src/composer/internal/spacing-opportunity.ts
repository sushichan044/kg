import type { PairSpacing } from "./spacing";
import type { SpacingSlot } from "./spacing-slot";

export type SpacingOpportunity = Readonly<{ slot: SpacingSlot; spacing: PairSpacing }>;
