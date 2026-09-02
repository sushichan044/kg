import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

/**
 * A repeated full stop or comma (句読点 — JLReq 句点類 cl-06 and 読点類 cl-07). Each ends its clause once,
 * so a run of them is not punctuation at all: it is a sentence trailing off, which Japanese prose
 * writes with `…`.
 */
export const noConsecutivePunctuationRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/no-consecutive-punctuation",
    pattern: /。。+|、、+/gu,
    message: "句読点が連続しています",
  });
