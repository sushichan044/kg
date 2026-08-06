import { defineProofreadingRule } from "../proofreading-rule-definition";
import { defineMatchRule } from "./internal/define-rule";

const RULE_ID = "kg/no-consecutive-interpunct";

export const noConsecutiveInterpunctRuleDefinition = defineProofreadingRule({
  id: RULE_ID,
  create: () =>
    defineMatchRule({
      id: RULE_ID,
      pattern: /・・+/gu,
      message: "中黒が連続しています",
    }),
});
