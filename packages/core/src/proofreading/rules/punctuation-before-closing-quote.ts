import { defineProofreadingRule } from "../proofreading-rule-definition";
import { characterClass, CLOSING_BRACKETS } from "./internal/brackets";
import { defineMatchRule } from "./internal/define-rule";

const RULE_ID = "kg/punctuation-before-closing-quote";
const PATTERN = new RegExp(`[。、]+(?=[${characterClass(CLOSING_BRACKETS)}])`, "gu");

export const punctuationBeforeClosingQuoteRuleDefinition = defineProofreadingRule({
  id: RULE_ID,
  create: () =>
    defineMatchRule({
      id: RULE_ID,
      pattern: PATTERN,
      message: "閉じ括弧の直前に句読点を置くことはできません",
    }),
});
