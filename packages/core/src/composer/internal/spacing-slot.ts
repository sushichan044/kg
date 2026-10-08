export type SpacingSlot =
  | Readonly<{ kind: "gap"; boundary: number }>
  | Readonly<{ kind: "character"; index: number }>;

export const SpacingSlot = {
  key: (slot: SpacingSlot): number =>
    slot.kind === "gap" ? slot.boundary * 2 : slot.index * 2 + 1,
} as const;
