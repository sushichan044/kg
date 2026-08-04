import type { ParsedProofreadingRule } from "../proofreading-rule";
import { dashRule } from "./dash";
import { ellipsisCharacterRule } from "./ellipsis-character";
import { evenEllipsisRule } from "./even-ellipsis";
import { fullwidthJapanesePunctuationRule } from "./fullwidth-japanese-punctuation";
import { maxArabicNumeralDigitsRule } from "./max-arabic-numeral-digits";
import { minusBeforeNumberRule } from "./minus-before-number";
import { noConsecutiveInterpunctRule } from "./no-consecutive-interpunct";
import { noConsecutivePunctuationRule } from "./no-consecutive-punctuation";
import { paragraphOpeningRule } from "./paragraph-opening";
import { punctuationBeforeClosingQuoteRule } from "./punctuation-before-closing-quote";
import { spaceAfterQuestionOrExclamationRule } from "./space-after-question-or-exclamation";
import { variantCharacterRule } from "./variant-character";

/**
 * The built-in rule set at its default configuration. Infallible by construction: every rule is
 * built from constants, so there is no options error for a caller to handle.
 *
 * Rules whose answer depends on the work's own conventions — which width numerals take, whether a
 * word is written in kanji or kana — are exported individually instead of included here.
 */
export function createDefaultProofreadingRules(): readonly ParsedProofreadingRule[] {
  return [
    paragraphOpeningRule(),
    punctuationBeforeClosingQuoteRule(),
    spaceAfterQuestionOrExclamationRule(),
    evenEllipsisRule(),
    dashRule(),
    ellipsisCharacterRule(),
    noConsecutivePunctuationRule(),
    noConsecutiveInterpunctRule(),
    minusBeforeNumberRule(),
    maxArabicNumeralDigitsRule(),
    fullwidthJapanesePunctuationRule(),
    variantCharacterRule(),
  ];
}
