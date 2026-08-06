import { defineProofreadingRule } from "../proofreading-rule-definition";
import { defineMatchRule } from "./internal/define-rule";

const RULE_ID = "kg/no-consecutive-punctuation";

export const noConsecutivePunctuationRuleDefinition = defineProofreadingRule({
  id: RULE_ID,
  create: () =>
    defineMatchRule({
      id: RULE_ID,
      pattern: /。。+|、、+/gu,
      message: "句読点が連続しています",
    }),
});
