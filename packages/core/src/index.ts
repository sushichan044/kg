// パイプラインを実行する呼び出し側と、その結果を描画するレンダラーが必要とするもの。
// パーサー、コンポーザー、測定器を書く場合は `@sushichan044/kg-core/plugin`、
// 校正ルールを書く場合は `@sushichan044/kg-core/lint` を使う。

export { ManuscriptResult } from "./result/manuscript-result";

export { parseManuscript } from "./parser/parse-manuscript";
export type { ParseManuscriptOptions } from "./parser/parse-manuscript";
export { ParseError } from "./parser/parse-error";
export { kakuyomuParser } from "./parser/kakuyomu-parser";
export { pixivParser } from "./parser/pixiv-parser";
export type { ParsedManuscript } from "./parser/parsed-manuscript";
export type { ManuscriptAnnotation } from "./parser/annotation/manuscript-annotation";

export { composeManuscript } from "./composer/compose-manuscript";
export type { ComposeManuscriptOptions } from "./composer/compose-manuscript";
export { ComposeError } from "./composer/compose-error";
export { novelComposer } from "./composer/novel-composer";
export type { NovelComposedManuscript } from "./composer/novel-composer";

export { NovelCompositionSettings } from "./composer/composition-settings";
export { NovelFlowSettings } from "./composer/novel-flow-settings";
export { ManuscriptOffsets } from "./composer/manuscript-offsets";
export { ManuscriptAppearanceSettings } from "./appearance/appearance-settings";
export { ManuscriptPageSettings } from "./composer/page-settings";
export { FontPreset } from "./appearance/font-preset";
export { prepareTextForFont, prepareManuscriptForFont } from "./appearance/font-preparation";
export type { PreparedFontManuscript } from "./appearance/font-preparation";
export { FontPresetId } from "./appearance/font-preset-id";
export { FontSizeQ } from "./appearance/font-size-q";
export { PaperSize } from "./appearance/paper-size";
export { PaperSizeId } from "./appearance/paper-size-id";

export type { NovelPage } from "./composer/novel-page";
export type { NovelLine } from "./composer/novel-line";
export type { SingleGlyphUnit } from "./composer/single-glyph-unit";
export type { ComposedAnnotationFragment } from "./composer/composed-annotation-fragment";
export type { AnnotationPlacement } from "./composer/annotation-placement";
export type { PresentationKind } from "./composer/presentation-kind";
export type { DiagnosticSeverity } from "./diagnostic/diagnostic-severity";

export { ManuscriptRange } from "./range/manuscript-range";

export { ManuscriptDiagnostic } from "./diagnostic/manuscript-diagnostic";
