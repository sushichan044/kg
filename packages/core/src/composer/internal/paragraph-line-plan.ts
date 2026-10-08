import type { LineBreakResult } from "../line-break-result";

type ResolvedSpacing = Readonly<{
  kind: "glue" | "kern";
  naturalWidthEm: number;
  widthEm: number;
}>;

export type ResolvedPairSpacing = ResolvedSpacing & Readonly<{ boundary: number }>;

export type ResolvedCharacterSpacing = ResolvedSpacing & Readonly<{ index: number }>;

export type ParagraphLinePlan = Readonly<{
  start: number;
  contentStart: number;
  end: number;
  suppressedIndexes: readonly number[];
  pairSpacings: readonly ResolvedPairSpacing[];
  /**
   * The atoms of this line the profile sets as an アキ instead of a box, at their resolved width.
   */
  characterSpacings: readonly ResolvedCharacterSpacing[];
  inlineSizeEm: number;
  break: LineBreakResult;
  hangingIndex: number | null;
}>;
