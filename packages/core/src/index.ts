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
export { RubyAnnotation, RubyKind, RubyReading } from "./parser/annotation/ruby-annotation";
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
export { ComposedAnnotationFragment } from "./composer/composed-annotation-fragment";
export { NovelCompositionSettings } from "./composer/composition-settings";
export { CompositionStatistics } from "./composer/composition-statistics";
export { ComposedInlineItem } from "./composer/composed-inline-item";
export type {
  ComposedGlue,
  ComposedGlyph,
  ComposedKern,
  SuppressedInlineItem,
} from "./composer/composed-inline-item";
export { InlineSpan } from "./composer/inline-span";
export { InlineMeasurement, logicalInlineMeasurer } from "./composer/inline-measurer";
export type { InlineMeasureRequest, InlineMeasurer } from "./composer/inline-measurer";
export { LineBreakResult } from "./composer/line-break-result";
export { LineOffset } from "./composer/line-offset";
export type { ManuscriptComposer } from "./composer/manuscript-composer";
export { ManuscriptGeometry } from "./composer/manuscript-geometry";
export { ManuscriptOffsets } from "./composer/manuscript-offsets";
export { createNovelComposer, novelComposer } from "./composer/novel-composer";
export type { NovelComposedManuscript } from "./composer/novel-composer";
export { NovelFlowSettings } from "./composer/novel-flow-settings";
export { NovelLayout } from "./composer/novel-layout";
export { NovelLine } from "./composer/novel-line";
export { NovelPage } from "./composer/novel-page";
export { NovelStage } from "./composer/novel-stage";
export { VerticalTextPresentation } from "./composer/vertical-text-presentation";

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
