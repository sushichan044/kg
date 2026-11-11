import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMixedWidthRule } from "./internal/mixed-width";

/**
 * 同一の作品の中の半角数字と全角数字。全角数字は自分の全角の枠に正立し、
 * 半角数字の二桁は縦中横としてその枠の中に組まれる。両者の混在は表記ゆれだが、
 * どちらを使うかは作品ごとの選択であるため、警告とする。
 */
export const consistentNumeralWidthRule = (): ParsedProofreadingRule =>
  defineMixedWidthRule({
    id: "kg/consistent-numeral-width",
    message:
      "半角数字「{{ halfwidth }}」と全角数字「{{ fullwidth }}」が混在しています。作品内の方針を確認してください",
    halfwidth: /[0-9]/u,
    fullwidth: /[０-９]/u,
  });
