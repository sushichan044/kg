export { ManuscriptResult } from "./result/manuscript-result";
export { Rejection } from "./result/rejection";
export { ValidationIssue } from "./result/validation-issue";
export { NamespacedId } from "./namespaced-id";

export { ManuscriptRange } from "./range/manuscript-range";
export { SourcePosition } from "./range/source-position";
export type { DisplayRange } from "./range/display-range";
export type { GraphemeRange } from "./range/grapheme-range";
export type { ManuscriptRangeInput } from "./range/manuscript-range";
export type { SourceRange } from "./range/source-range";
export type { TextRange } from "./range/text-range";

export { ManuscriptDiagnostic } from "./diagnostic/manuscript-diagnostic";
export type { DiagnosticOrigin } from "./diagnostic/diagnostic-origin";
export type { DiagnosticSeverity } from "./diagnostic/diagnostic-severity";
export type { ManuscriptDiagnosticInput } from "./diagnostic/manuscript-diagnostic";

export { ManuscriptAppearanceSettings } from "./appearance/appearance-settings";
export { FontPreset } from "./appearance/font-preset";
export { FontPresetId } from "./appearance/font-preset-id";
export { FontSizePt } from "./appearance/font-size-pt";
export { mmToPt, ptToMm } from "./appearance/length";
export { PaperSize } from "./appearance/paper-size";
export { PaperSizeId } from "./appearance/paper-size-id";

export { ManuscriptAnnotation } from "./parser/annotation/manuscript-annotation";
export { ParseError } from "./parser/parse-error";
export { parseManuscript } from "./parser/parse-manuscript";
export { ParsedManuscript } from "./parser/parsed-manuscript";
export { kakuyomuParser } from "./parser/kakuyomu-parser";
export { pixivParser } from "./parser/pixiv-parser";
export { plainTextParser } from "./parser/plain-text-parser";
export type { BoldAnnotation } from "./parser/annotation/bold-annotation";
export type { EmphasisAnnotation } from "./parser/annotation/emphasis-annotation";
export type { ItalicAnnotation } from "./parser/annotation/italic-annotation";
export type { RubyAnnotation, RubyKind, RubyReading } from "./parser/annotation/ruby-annotation";
export type { ManuscriptParser } from "./parser/manuscript-parser";
export type { ParseManuscriptOptions } from "./parser/parse-manuscript";
export type { ParsedGrapheme } from "./parser/parsed-grapheme";

export { ComposeError } from "./composer/compose-error";
export { composeManuscript } from "./composer/compose-manuscript";
export { NovelCompositionSettings } from "./composer/composition-settings";
export { logicalInlineMeasurer } from "./composer/inline-measurer";
export { LineOffset } from "./composer/line-offset";
export { ManuscriptGeometry } from "./composer/manuscript-geometry";
export { ManuscriptOffsets } from "./composer/manuscript-offsets";
export { createNovelComposer, novelComposer } from "./composer/novel-composer";
export { NovelFlowSettings } from "./composer/novel-flow-settings";
export type { ComposeManuscriptOptions } from "./composer/compose-manuscript";
export type { ComposedAnnotationFragment } from "./composer/composed-annotation-fragment";
export type {
  ComposedGlue,
  ComposedGlyph,
  ComposedInlineItem,
  ComposedKern,
  SuppressedInlineItem,
} from "./composer/composed-inline-item";
export type { ComposedManuscript } from "./composer/composed-manuscript";
export type { CompositionStatistics } from "./composer/composition-statistics";
export type {
  InlineMeasureRequest,
  InlineMeasurement,
  InlineMeasurer,
} from "./composer/inline-measurer";
export type { InlineSpan } from "./composer/inline-span";
export type { LineBreakResult } from "./composer/line-break-result";
export type { ManuscriptComposer } from "./composer/manuscript-composer";
export type { NovelComposedManuscript } from "./composer/novel-composer";
export type { NovelLayout } from "./composer/novel-layout";
export type { NovelLine } from "./composer/novel-line";
export type { NovelPage } from "./composer/novel-page";
export type { NovelStage } from "./composer/novel-stage";
export type { VerticalTextPresentation } from "./composer/vertical-text-presentation";
