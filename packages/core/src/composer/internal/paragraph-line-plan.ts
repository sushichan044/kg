import type { LineBreakResult } from "../line-break-result";
import type { BoxAdjustment } from "./box-adjustment";

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
   * この行のアトムのうち、プロファイルがボックスではなくアキとして組むもの。
   * 幅は解決済みの値を持つ。
   */
  characterSpacings: readonly ResolvedCharacterSpacing[];
  inlineSizeEm: number;
  break: LineBreakResult;
  hangingIndex: number | null;
  boxAdjustments?: readonly BoxAdjustment[];
}>;
