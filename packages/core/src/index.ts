// What a caller needs to run the pipeline, and what a renderer needs to draw its result.
// Writing a parser, composer or measurer is `@sushichan044/kg-core/plugin`; proofreading is
// `@sushichan044/kg-core/lint`.

export { ManuscriptResult } from "./result/manuscript-result";

export { parseManuscript } from "./parser/parse-manuscript";
export { ParseError } from "./parser/parse-error";
export { kakuyomuParser } from "./parser/kakuyomu-parser";
export { pixivParser } from "./parser/pixiv-parser";
export { plainTextParser } from "./parser/plain-text-parser";
export type { ParseManuscriptOptions } from "./parser/parse-manuscript";
export type { ParsedManuscript } from "./parser/parsed-manuscript";
export type { ParsedGrapheme } from "./parser/parsed-grapheme";
export type { ManuscriptAnnotation } from "./parser/annotation/manuscript-annotation";
export type { BoldAnnotation } from "./parser/annotation/bold-annotation";
export type { EmphasisAnnotation } from "./parser/annotation/emphasis-annotation";
export type { ItalicAnnotation } from "./parser/annotation/italic-annotation";
export type { RubyAnnotation, RubyKind, RubyReading } from "./parser/annotation/ruby-annotation";

export { composeManuscript } from "./composer/compose-manuscript";
export { ComposeError } from "./composer/compose-error";
export { novelComposer } from "./composer/novel-composer";
export type { ComposeManuscriptOptions } from "./composer/compose-manuscript";
export type { ComposedManuscript } from "./composer/composed-manuscript";
export type { NovelComposedManuscript } from "./composer/novel-composer";

export { NovelCompositionSettings } from "./composer/composition-settings";
export { NovelFlowSettings } from "./composer/novel-flow-settings";
export { ManuscriptOffsets } from "./composer/manuscript-offsets";
export { ManuscriptAppearanceSettings } from "./appearance/appearance-settings";
export { ManuscriptGeometry } from "./composer/manuscript-geometry";
export { FontPreset } from "./appearance/font-preset";
export { FontPresetId } from "./appearance/font-preset-id";
export { FontSizePt } from "./appearance/font-size-pt";
export { PaperSize } from "./appearance/paper-size";
export { PaperSizeId } from "./appearance/paper-size-id";
export type { LineOffset } from "./composer/line-offset";

export type { NovelLayout } from "./composer/novel-layout";
export type { NovelPage } from "./composer/novel-page";
export type { NovelStage } from "./composer/novel-stage";
export type { NovelLine } from "./composer/novel-line";
export type { CompositionStatistics } from "./composer/composition-statistics";
export type { LineBreakResult } from "./composer/line-break-result";
export type { InlineSpan } from "./composer/inline-span";
export type { VerticalTextPresentation } from "./composer/vertical-text-presentation";
export type { ComposedAnnotationFragment } from "./composer/composed-annotation-fragment";
export type {
  ComposedGlue,
  ComposedGlyph,
  ComposedInlineItem,
  ComposedKern,
  SuppressedInlineItem,
} from "./composer/composed-inline-item";

export { ManuscriptRange } from "./range/manuscript-range";
export type { ManuscriptRangeInput } from "./range/manuscript-range";
export type { DisplayRange } from "./range/display-range";
export type { GraphemeRange } from "./range/grapheme-range";
export type { SourceRange } from "./range/source-range";
export type { SourcePosition } from "./range/source-position";
export type { TextRange } from "./range/text-range";

export { ManuscriptDiagnostic } from "./diagnostic/manuscript-diagnostic";
export type { ManuscriptDiagnosticInput } from "./diagnostic/manuscript-diagnostic";
export type { DiagnosticOrigin } from "./diagnostic/diagnostic-origin";
export type { DiagnosticSeverity } from "./diagnostic/diagnostic-severity";
