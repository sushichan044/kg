import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMixedWidthRule } from "./internal/mixed-width";

/**
 * Halfwidth and fullwidth digits (半角数字 and 全角数字) in one work. A fullwidth digit stands upright on
 * its own em; a halfwidth pair sets as 縦中横 inside one. Mixing them is 表記ゆれ, but which one a work
 * uses is its own choice, hence a warning.
 */
export const consistentNumeralWidthRule = (): ParsedProofreadingRule =>
  defineMixedWidthRule({
    id: "kg/consistent-numeral-width",
    message:
      "半角数字「{{ halfwidth }}」と全角数字「{{ fullwidth }}」が混在しています。作品内の方針を確認してください",
    halfwidth: /[0-9]/u,
    fullwidth: /[０-９]/u,
  });
