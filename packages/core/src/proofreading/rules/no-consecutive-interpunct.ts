import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

export const noConsecutiveInterpunctRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/no-consecutive-interpunct",
    pattern: /・・+/gu,
    message: "中黒が連続しています",
  });
