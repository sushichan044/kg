import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

/**
 * 後ろに数字が続かないマイナス記号（U+2212、JLReq の演算記号）。ほとんどの場合、
 * ダッシュか長音記号の打ち間違いである。これらは見た目が似ているが文字クラスが異なるので、
 * アキの付け方も行の分割の仕方も異なる。
 */
export const minusBeforeNumberRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/minus-before-number",
    pattern: /−(?![0-9０-９〇一二三四五六七八九十])/gu,
    message: "マイナス記号の直後には数字が必要です",
  });
