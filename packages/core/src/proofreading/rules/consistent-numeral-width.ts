import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMixedWidthRule } from "./internal/mixed-width";

export const consistentNumeralWidthRule = (): ParsedProofreadingRule =>
  defineMixedWidthRule({
    id: "kg/consistent-numeral-width",
    message:
      "半角数字「{{ halfwidth }}」と全角数字「{{ fullwidth }}」が混在しています。作品内の方針を確認してください",
    halfwidth: /[0-9]/u,
    fullwidth: /[０-９]/u,
  });
