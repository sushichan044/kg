import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

/**
 * A minus sign (U+2212, JLReq 演算記号) with no number after it. It is almost always a mistyped dash or
 * prolonged sound mark, which look alike but belong to different character classes and so are
 * spaced and broken differently.
 */
export const minusBeforeNumberRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/minus-before-number",
    pattern: /−(?![0-9０-９〇一二三四五六七八九十])/gu,
    message: "マイナス記号の直後には数字が必要です",
  });
