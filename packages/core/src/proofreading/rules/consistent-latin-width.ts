import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMixedWidthRule } from "./internal/mixed-width";

export const consistentLatinWidthRule = (): ParsedProofreadingRule =>
  defineMixedWidthRule({
    id: "kg/consistent-latin-width",
    message:
      "半角英字「{{ halfwidth }}」と全角英字「{{ fullwidth }}」が混在しています。作品内の方針を確認してください",
    halfwidth: /[A-Za-z]/u,
    fullwidth: /[Ａ-Ｚａ-ｚ]/u,
  });
