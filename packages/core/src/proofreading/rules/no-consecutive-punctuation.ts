import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

/**
 * A repeated full stop or comma (句読点 — JLReq 句点類 cl-06 and 読点類 cl-07). Each ends its clause once; a
 * run of them is a trailing-off the manuscript should write with `…` instead.
 */
export const noConsecutivePunctuationRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/no-consecutive-punctuation",
    pattern: /。。+|、、+/gu,
    message: "句読点が連続しています",
  });
