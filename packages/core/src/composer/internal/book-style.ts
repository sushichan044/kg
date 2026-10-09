import { defaultAnnotationStyle } from "./annotation-style";
import type { AnnotationStyle } from "./annotation-style";
import type {
  AdjustmentCategory,
  JapaneseCharacterClass,
  LineHeadKind,
} from "./japanese-typesetting-rules";
import type { PairSpacing } from "./spacing";

export type BookStyle = Readonly<{
  adjustment: (
    direction: "shrink" | "stretch",
    category: AdjustmentCategory,
  ) => Readonly<{ stage: number; costPerEm: number }>;
  lineStartSpacing: (first: JapaneseCharacterClass, head: LineHeadKind) => PairSpacing | null;
  finalStretchCostPerEm: number;
  annotation: AnnotationStyle;
}>;

// kg reduces invisible line-end space before Western word spaces. This order is a product
// choice; JLReq 3.8.3 puts word-space reduction first.
const shrink = {
  "line-end": { stage: 0, costPerEm: 0 },
  "word-space": { stage: 1, costPerEm: 1 },
  "middle-dot": { stage: 2, costPerEm: 2 },
  punctuation: { stage: 3, costPerEm: 3 },
  "mixed-text": { stage: 4, costPerEm: 4 },
  solid: { stage: 4, costPerEm: 4 },
} as const;
const stretch = {
  "word-space": { stage: 1, costPerEm: 1 },
  "mixed-text": { stage: 2, costPerEm: 2 },
  solid: { stage: 3, costPerEm: 3 },
  "line-end": { stage: 3, costPerEm: 3 },
  "middle-dot": { stage: 3, costPerEm: 3 },
  punctuation: { stage: 3, costPerEm: 3 },
} as const;

export const defaultBookStyle: BookStyle = {
  adjustment: (direction, category) => (direction === "shrink" ? shrink : stretch)[category],
  // JLReq 3.1.5 scheme ③: half-em at paragraph start and flush at a turned-over head.
  lineStartSpacing: (first, head) =>
    first === "cl-01" && head === "paragraph-start" ? { kind: "glue", naturalWidthEm: 0.5 } : null,
  finalStretchCostPerEm: 4,
  annotation: defaultAnnotationStyle,
};
