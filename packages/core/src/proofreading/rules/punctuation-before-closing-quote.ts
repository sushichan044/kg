import type { ParsedProofreadingRule } from "../proofreading-rule";
import { characterClass, CLOSING_BRACKETS } from "./internal/brackets";
import { defineMatchRule } from "./internal/define-rule";

const PATTERN = new RegExp(`[。、]+(?=[${characterClass(CLOSING_BRACKETS)}])`, "gu");

export const punctuationBeforeClosingQuoteRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/punctuation-before-closing-quote",
    pattern: PATTERN,
    message: "閉じ括弧の直前に句読点を置くことはできません",
  });
