export { InvalidRuleOptions } from "./proofreading/invalid-rule-options";
export { ProofreadError } from "./proofreading/proofread-error";
export { proofreadManuscript } from "./proofreading/proofread-manuscript";
export { ProofreadingRuleMeta } from "./proofreading/proofreading-rule";
export type { ProofreadOptions } from "./proofreading/proofread-manuscript";
export type { ProofreadingReport } from "./proofreading/proofreading-report";
export type {
  ComposedProofreadingRule,
  ParsedProofreadingRule,
  ProofreadingRule,
  ProofreadingRuleMessages,
} from "./proofreading/proofreading-rule";
export type { ProofreadingRuleContext } from "./proofreading/proofreading-rule-context";

export {
  consistentKanjiOpeningRule,
  createConsistentKanjiOpeningRule,
} from "./proofreading/rules/consistent-kanji-opening";
export type {
  ConsistentKanjiOpeningOptions,
  KanjiOpeningPair,
} from "./proofreading/rules/consistent-kanji-opening";
export { consistentLatinWidthRule } from "./proofreading/rules/consistent-latin-width";
export { consistentNumeralWidthRule } from "./proofreading/rules/consistent-numeral-width";
export { createDashRule, dashRule } from "./proofreading/rules/dash";
export type { DashOptions } from "./proofreading/rules/dash";
export { createDefaultProofreadingRules } from "./proofreading/rules/default-rules";
export { ellipsisCharacterRule } from "./proofreading/rules/ellipsis-character";
export { evenEllipsisRule } from "./proofreading/rules/even-ellipsis";
export { fullwidthJapanesePunctuationRule } from "./proofreading/rules/fullwidth-japanese-punctuation";
export {
  createMaxArabicNumeralDigitsRule,
  maxArabicNumeralDigitsRule,
} from "./proofreading/rules/max-arabic-numeral-digits";
export type { MaxArabicNumeralDigitsOptions } from "./proofreading/rules/max-arabic-numeral-digits";
export { minusBeforeNumberRule } from "./proofreading/rules/minus-before-number";
export { noConsecutiveInterpunctRule } from "./proofreading/rules/no-consecutive-interpunct";
export { noConsecutivePunctuationRule } from "./proofreading/rules/no-consecutive-punctuation";
export {
  createParagraphOpeningRule,
  paragraphOpeningRule,
} from "./proofreading/rules/paragraph-opening";
export type { ParagraphOpeningOptions } from "./proofreading/rules/paragraph-opening";
export { punctuationBeforeClosingQuoteRule } from "./proofreading/rules/punctuation-before-closing-quote";
export { spaceAfterQuestionOrExclamationRule } from "./proofreading/rules/space-after-question-or-exclamation";
export { variantCharacterRule } from "./proofreading/rules/variant-character";
