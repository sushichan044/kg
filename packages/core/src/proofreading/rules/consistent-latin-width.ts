import { defineProofreadingRule } from "../proofreading-rule-definition";
import { defineMixedWidthRule } from "./internal/mixed-width";

const RULE_ID = "kg/consistent-latin-width";

export const consistentLatinWidthRuleDefinition = defineProofreadingRule({
  id: RULE_ID,
  create: () =>
    defineMixedWidthRule({
      id: RULE_ID,
      message:
        "半角英字「{{ halfwidth }}」と全角英字「{{ fullwidth }}」が混在しています。作品内の方針を確認してください",
      halfwidth: /[A-Za-z]/u,
      fullwidth: /[Ａ-Ｚａ-ｚ]/u,
    }),
});
