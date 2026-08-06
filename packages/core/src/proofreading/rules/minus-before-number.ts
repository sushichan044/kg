import { defineProofreadingRule } from "../proofreading-rule-definition";
import { defineMatchRule } from "./internal/define-rule";

const RULE_ID = "kg/minus-before-number";

export const minusBeforeNumberRuleDefinition = defineProofreadingRule({
  id: RULE_ID,
  create: () =>
    defineMatchRule({
      id: RULE_ID,
      pattern: /−(?![0-9０-９〇一二三四五六七八九十])/gu,
      message: "マイナス記号の直後には数字が必要です",
    }),
});
