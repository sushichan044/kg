export { assertNever } from "./assert-never";
export { NamespacedId } from "./namespaced-id";

export { ManuscriptResult } from "./result/manuscript-result";
export { Rejection } from "./result/rejection";
export { ValidationIssue } from "./result/validation-issue";

export { DisplayRange } from "./range/display-range";
export { GraphemeRange } from "./range/grapheme-range";
export { ManuscriptRange } from "./range/manuscript-range";
export type { ManuscriptRangeInput } from "./range/manuscript-range";
export { SourcePosition } from "./range/source-position";
export { SourceRange } from "./range/source-range";
export { TextRange } from "./range/text-range";

export { DiagnosticOrigin } from "./diagnostic/diagnostic-origin";
export { DiagnosticSeverity } from "./diagnostic/diagnostic-severity";
export { ManuscriptDiagnostic } from "./diagnostic/manuscript-diagnostic";
export type { ManuscriptDiagnosticInput } from "./diagnostic/manuscript-diagnostic";

export { ManuscriptAppearanceSettings } from "./appearance/appearance-settings";
export { FontPreset } from "./appearance/font-preset";
export { FontPresetId } from "./appearance/font-preset-id";
export { FontSizePt } from "./appearance/font-size-pt";
export { mmToPt, ptToMm } from "./appearance/length";
export { PaperSize } from "./appearance/paper-size";
export { PaperSizeId } from "./appearance/paper-size-id";

export { BoldAnnotation } from "./parser/annotation/bold-annotation";
export { EmphasisAnnotation } from "./parser/annotation/emphasis-annotation";
export { ItalicAnnotation } from "./parser/annotation/italic-annotation";
export { ManuscriptAnnotation } from "./parser/annotation/manuscript-annotation";
export { RubyAnnotation } from "./parser/annotation/ruby-annotation";
export type { ManuscriptParser } from "./parser/manuscript-parser";
export { ParseError } from "./parser/parse-error";
export { parseManuscript } from "./parser/parse-manuscript";
export type { ParseManuscriptOptions } from "./parser/parse-manuscript";
export { ParsedGrapheme } from "./parser/parsed-grapheme";
export { ParsedManuscript } from "./parser/parsed-manuscript";
export { kakuyomuParser } from "./parser/kakuyomu-parser";
export { pixivParser } from "./parser/pixiv-parser";
export { plainTextParser } from "./parser/plain-text-parser";

export { ComposeError } from "./composer/compose-error";
export { composeManuscript } from "./composer/compose-manuscript";
export type { ComposeManuscriptOptions } from "./composer/compose-manuscript";
export type { ComposedManuscript } from "./composer/composed-manuscript";
export { ManuscriptCompositionSettings } from "./composer/composition-settings";
export { CompositionStatistics } from "./composer/composition-statistics";
export { GridCell } from "./composer/grid-cell";
export { manuscriptGridComposer } from "./composer/grid-composer";
export type { GridComposedManuscript } from "./composer/grid-composer";
export { GridLine } from "./composer/grid-line";
export { GridPage } from "./composer/grid-page";
export { GridSettings } from "./composer/grid-settings";
export { GridStage } from "./composer/grid-stage";
export { KinsokuSettings } from "./composer/kinsoku-settings";
export { LineOffset } from "./composer/line-offset";
export type { ManuscriptComposer } from "./composer/manuscript-composer";
export { ManuscriptGeometry } from "./composer/manuscript-geometry";
export { ManuscriptGridLayout } from "./composer/manuscript-grid-layout";
export { ManuscriptOffsets } from "./composer/manuscript-offsets";

export { InvalidRuleOptions } from "./proofreading/invalid-rule-options";
export { ProofreadError } from "./proofreading/proofread-error";
export { proofreadManuscript } from "./proofreading/proofread-manuscript";
export type { ProofreadOptions } from "./proofreading/proofread-manuscript";
export { ProofreadingReport } from "./proofreading/proofreading-report";
export { ProofreadingRuleMeta } from "./proofreading/proofreading-rule";
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
