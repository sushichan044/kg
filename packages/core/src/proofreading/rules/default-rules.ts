import type { ParsedProofreadingRule } from "../proofreading-rule";
import { dashCharacterRule } from "./dash-character";
import { ellipsisCharacterRule } from "./ellipsis-character";
import { evenDashRule } from "./even-dash";
import { evenEllipsisRule } from "./even-ellipsis";
import { fullwidthJapanesePunctuationRule } from "./fullwidth-japanese-punctuation";
import { maxArabicNumeralDigitsRule } from "./max-arabic-numeral-digits";
import { minusBeforeNumberRule } from "./minus-before-number";
import { noConsecutiveChoonpuRule } from "./no-consecutive-choonpu";
import { noConsecutiveInterpunctRule } from "./no-consecutive-interpunct";
import { noConsecutivePunctuationRule } from "./no-consecutive-punctuation";
import { noIndentBeforeOpeningBracketRule } from "./no-indent-before-opening-bracket";
import { paragraphIndentWidthRule } from "./paragraph-indent-width";
import { paragraphLeadingCharacterRule } from "./paragraph-leading-character";
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
    paragraphLeadingCharacterRule(),
    paragraphIndentWidthRule(),
    noIndentBeforeOpeningBracketRule(),
    punctuationBeforeClosingQuoteRule(),
    spaceAfterQuestionOrExclamationRule(),
    evenEllipsisRule(),
    evenDashRule(),
    ellipsisCharacterRule(),
    dashCharacterRule(),
    noConsecutivePunctuationRule(),
    noConsecutiveInterpunctRule(),
    noConsecutiveChoonpuRule(),
    minusBeforeNumberRule(),
    maxArabicNumeralDigitsRule(),
    fullwidthJapanesePunctuationRule(),
    variantCharacterRule(),
  ];
}
