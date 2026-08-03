import type { ParsedProofreadingRule } from "../proofreading-rule";
import { evenDashRule } from "./even-dash";
import { evenEllipsisRule } from "./even-ellipsis";
import { maxArabicNumeralDigitsRule } from "./max-arabic-numeral-digits";
import { minusBeforeNumberRule } from "./minus-before-number";
import { noConsecutiveChoonpuRule } from "./no-consecutive-choonpu";
import { noConsecutiveInterpunctRule } from "./no-consecutive-interpunct";
import { noConsecutivePunctuationRule } from "./no-consecutive-punctuation";
import { paragraphLeadingCharacterRule } from "./paragraph-leading-character";
import { punctuationBeforeClosingQuoteRule } from "./punctuation-before-closing-quote";
import { spaceAfterQuestionOrExclamationRule } from "./space-after-question-or-exclamation";
import { variantCharacterRule } from "./variant-character";

/**
 * The built-in rule set at its default configuration. Infallible by construction: every rule is
 * built from constants, so there is no options error for a caller to handle.
 */
export function createDefaultProofreadingRules(): readonly ParsedProofreadingRule[] {
  return [
    paragraphLeadingCharacterRule(),
    punctuationBeforeClosingQuoteRule(),
    spaceAfterQuestionOrExclamationRule(),
    evenEllipsisRule(),
    evenDashRule(),
    noConsecutivePunctuationRule(),
    noConsecutiveInterpunctRule(),
    noConsecutiveChoonpuRule(),
    minusBeforeNumberRule(),
    maxArabicNumeralDigitsRule(),
    variantCharacterRule(),
  ];
}
