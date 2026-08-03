import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

export const noConsecutivePunctuationRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/no-consecutive-punctuation",
    pattern: /。。+|、、+/gu,
    message: "句読点が連続しています",
  });
