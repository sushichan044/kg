import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

export const minusBeforeNumberRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/minus-before-number",
    pattern: /−(?![0-9０-９〇一二三四五六七八九十])/gu,
    message: "マイナス記号の直後には数字が必要です",
  });
