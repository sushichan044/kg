import { consistentKanjiOpeningRuleDefinition } from "./consistent-kanji-opening";
import { consistentLatinWidthRuleDefinition } from "./consistent-latin-width";
import { consistentNumeralWidthRuleDefinition } from "./consistent-numeral-width";
import { dashRuleDefinition } from "./dash";
import { ellipsisCharacterRuleDefinition } from "./ellipsis-character";
import { evenEllipsisRuleDefinition } from "./even-ellipsis";
import { fullwidthJapanesePunctuationRuleDefinition } from "./fullwidth-japanese-punctuation";
import { halfwidthPunctuationNearJapaneseRuleDefinition } from "./halfwidth-punctuation-near-japanese";
import { maxArabicNumeralDigitsRuleDefinition } from "./max-arabic-numeral-digits";
import { minusBeforeNumberRuleDefinition } from "./minus-before-number";
import { noConsecutiveInterpunctRuleDefinition } from "./no-consecutive-interpunct";
import { noConsecutivePunctuationRuleDefinition } from "./no-consecutive-punctuation";
import { paragraphOpeningRuleDefinition } from "./paragraph-opening";
import { punctuationBeforeClosingQuoteRuleDefinition } from "./punctuation-before-closing-quote";
import { spaceAfterQuestionOrExclamationRuleDefinition } from "./space-after-question-or-exclamation";
import { variantCharacterRuleDefinition } from "./variant-character";

/**
 * Every built-in proofreading rule, as a definition rather than an instance. `resolveProofreading
 * Rules` looks a config entry's ID up here; `ProofreadingRuleSettings` derives its key set from
 * this same list, so a rule can never be configurable in one place and not the other.
 */
export const proofreadingRuleRegistry = [
  paragraphOpeningRuleDefinition,
  punctuationBeforeClosingQuoteRuleDefinition,
  spaceAfterQuestionOrExclamationRuleDefinition,
  evenEllipsisRuleDefinition,
  dashRuleDefinition,
  ellipsisCharacterRuleDefinition,
  noConsecutivePunctuationRuleDefinition,
  noConsecutiveInterpunctRuleDefinition,
  minusBeforeNumberRuleDefinition,
  maxArabicNumeralDigitsRuleDefinition,
  fullwidthJapanesePunctuationRuleDefinition,
  halfwidthPunctuationNearJapaneseRuleDefinition,
  variantCharacterRuleDefinition,
  consistentKanjiOpeningRuleDefinition,
  consistentLatinWidthRuleDefinition,
  consistentNumeralWidthRuleDefinition,
] as const;

export type ProofreadingRuleRegistry = typeof proofreadingRuleRegistry;
