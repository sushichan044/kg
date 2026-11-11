import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMixedWidthRule } from "./internal/mixed-width";

/**
 * 同一の作品の中の半角英字と全角英字。縦組では両者の組み方が異なる。
 * 全角の英字は自分の全角の枠に正立し、半角の英字は横倒しになることがある連なりに加わる。
 * そのため、混在は読み手に見える表記ゆれになる。どちらを使うかは作品ごとの選択であるため、
 * 警告とする。
 */
export const consistentLatinWidthRule = (): ParsedProofreadingRule =>
  defineMixedWidthRule({
    id: "kg/consistent-latin-width",
    message:
      "半角英字「{{ halfwidth }}」と全角英字「{{ fullwidth }}」が混在しています。作品内の方針を確認してください",
    halfwidth: /[A-Za-z]/u,
    fullwidth: /[Ａ-Ｚａ-ｚ]/u,
  });
