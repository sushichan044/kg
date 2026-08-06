import { defineProofreadingRule } from "../proofreading-rule-definition";
import { defineMixedWidthRule } from "./internal/mixed-width";

const RULE_ID = "kg/consistent-numeral-width";

export const consistentNumeralWidthRuleDefinition = defineProofreadingRule({
  id: RULE_ID,
  create: () =>
    defineMixedWidthRule({
      id: RULE_ID,
      message:
        "半角数字「{{ halfwidth }}」と全角数字「{{ fullwidth }}」が混在しています。作品内の方針を確認してください",
      halfwidth: /[0-9]/u,
      fullwidth: /[０-９]/u,
    }),
});
