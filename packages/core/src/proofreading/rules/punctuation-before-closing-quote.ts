import { characterClass, CLOSING_BRACKETS } from "../../internal/japanese-brackets";
import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

const PATTERN = new RegExp(`[。、]+(?=[${characterClass(CLOSING_BRACKETS)}])`, "gu");

/**
 * A full stop or comma immediately before a closing bracket (終わり括弧類). The bracket already closes
 * the quotation, and both characters are set on a half em, so the pair reads as a gap in the line
 * rather than as punctuation. Japanese practice drops the punctuation and keeps the bracket.
 */
export const punctuationBeforeClosingQuoteRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/punctuation-before-closing-quote",
    pattern: PATTERN,
    message: "閉じ括弧の直前に句読点を置くことはできません",
  });
