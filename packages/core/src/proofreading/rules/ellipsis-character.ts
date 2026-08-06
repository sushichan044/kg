import { defineProofreadingRule } from "../proofreading-rule-definition";
import { defineMatchRule } from "./internal/define-rule";

const RULE_ID = "kg/ellipsis-character";

/**
 * Stand-ins for `…`. Runs of `。` and `・` are left to the rules that already count them, so one
 * substitute is never reported twice.
 */
export const ellipsisCharacterRuleDefinition = defineProofreadingRule({
  id: RULE_ID,
  create: () =>
    defineMatchRule({
      id: RULE_ID,
      pattern: /\.{3,}|⋯+/gu,
      message: "三点リーダーには「…」を使ってください",
    }),
});
