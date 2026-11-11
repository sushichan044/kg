import { characterClass, CLOSING_BRACKETS } from "../../internal/japanese-brackets";
import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

const PATTERN = new RegExp(`[。、]+(?=[${characterClass(CLOSING_BRACKETS)}])`, "gu");

/**
 * 終わり括弧類の直前にある句点または読点。括弧がすでに引用を閉じており、
 * どちらの文字も二分で組まれるので、この対は約物ではなく行の中の空きのように読める。
 * 日本語の慣行では、約物を落として括弧を残す。
 */
export const punctuationBeforeClosingQuoteRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/punctuation-before-closing-quote",
    pattern: PATTERN,
    message: "閉じ括弧の直前に句読点を置くことはできません",
  });
