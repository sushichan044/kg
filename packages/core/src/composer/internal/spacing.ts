export type SpacingCapacity = Readonly<{
  stage: number;
  costPerEm: number;
  amountEm: number;
  granularity: "continuous" | "all-or-nothing";
}>;

export type PairSpacing = Readonly<{
  kind: "glue" | "kern";
  naturalWidthEm: number;
  shrink?: SpacingCapacity;
  stretch?: SpacingCapacity;
}>;

export type CharacterSpacing = PairSpacing & Readonly<{ kind: "glue" }>;
export type LineEndSpacing = Readonly<{
  spacing: PairSpacing;
  absorbsPrecedingEm: number;
}>;
