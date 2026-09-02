import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMixedWidthRule } from "./internal/mixed-width";

/**
 * Halfwidth and fullwidth Latin letters (半角英字 and 全角英字) in one work. In vertical writing the two
 * are set differently — a fullwidth letter stands upright on its own em, a halfwidth one joins a
 * run that may turn sideways — so mixing them is 表記ゆれ the reader can see. Which one a work uses is
 * its own choice, hence a warning.
 */
export const consistentLatinWidthRule = (): ParsedProofreadingRule =>
  defineMixedWidthRule({
    id: "kg/consistent-latin-width",
    message:
      "半角英字「{{ halfwidth }}」と全角英字「{{ fullwidth }}」が混在しています。作品内の方針を確認してください",
    halfwidth: /[A-Za-z]/u,
    fullwidth: /[Ａ-Ｚａ-ｚ]/u,
  });
