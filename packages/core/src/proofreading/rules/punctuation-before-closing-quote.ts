import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

export const punctuationBeforeClosingQuoteRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/punctuation-before-closing-quote",
    pattern: /[。、]+(?=[」』〗〉》）)”"’'］\]〕｝}＞>])/gu,
    message: "閉じ括弧の直前に句読点を置くことはできません",
  });
