import { defineProofreadingRule } from "../proofreading-rule-definition";
import { defineMatchRule } from "./internal/define-rule";

const RULE_ID = "kg/even-ellipsis";

export const evenEllipsisRuleDefinition = defineProofreadingRule({
  id: RULE_ID,
  create: () =>
    defineMatchRule({
      id: RULE_ID,
      pattern: /…+/gu,
      accept: (match) => match[0].length % 2 === 1,
      message: "連続する三点リーダーの数は偶数にしてください",
    }),
});
