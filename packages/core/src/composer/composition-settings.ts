import * as v from "valibot";

import { A5_PAGE_FORMAT } from "../appearance/a5-page-format";
import { A6_PAGE_FORMAT } from "../appearance/a6-page-format";
import { ManuscriptAppearanceSettings } from "../appearance/appearance-settings";
import type { PaperSizeId } from "../appearance/paper-size-id";
import { validAdditionalSentenceEndingMarks } from "../internal/japanese-punctuation";
import { readonlyObject } from "../internal/schema";
import { LineOffset } from "./line-offset";
import { ManuscriptGeometry } from "./manuscript-geometry";
import { ManuscriptOffsets } from "./manuscript-offsets";
import { NovelFlowSettings } from "./novel-flow-settings";
import { ManuscriptPageSettings } from "./page-settings";

const NovelCompositionSettingsSchema = v.pipe(
  readonlyObject({
    additionalSentenceEndingMarks: v.optional(
      v.pipe(v.string(), v.check(validAdditionalSentenceEndingMarks)),
    ),
    flow: NovelFlowSettings.schema,
    offsets: ManuscriptOffsets.schema,
    appearance: ManuscriptAppearanceSettings.schema,
    page: ManuscriptPageSettings.schema,
  }),
  v.check(
    ({ flow, offsets }) =>
      LineOffset.total(offsets.stage) <= ManuscriptOffsets.maxStageTotal(flow) &&
      LineOffset.total(offsets.page) <= ManuscriptOffsets.maxPageTotal(flow, offsets.stage),
    "page or stage offsets leave no usable novel lines",
  ),
  v.check(({ flow, appearance, page }) => {
    const geometry = ManuscriptGeometry.of(flow, appearance, page);
    return (
      Math.abs(geometry.contentHeightMm + page.topMm + page.bottomMm - geometry.paperHeightMm) <=
        1e-6 &&
      Math.abs(geometry.contentWidthMm + page.innerMm + page.outerMm - geometry.paperWidthMm) <=
        1e-6
    );
  }, "text dimensions and margins must match the paper dimensions"),
  v.check(
    ({ appearance, page }) => page.lineGapMm + 1e-6 >= appearance.fontSizeQ / 8,
    "line gap must leave room for half-size annotations",
  ),
  v.check(({ flow, appearance, page }) => {
    const format =
      appearance.paperSize === "a5"
        ? A5_PAGE_FORMAT
        : appearance.paperSize === "a6"
          ? A6_PAGE_FORMAT
          : null;
    return (
      format === null ||
      (appearance.fontSizeQ === format.fontSizeQ &&
        flow.lineLengthEm === format.flow.lineLengthEm &&
        flow.linesPerStage === format.flow.linesPerStage &&
        flow.stagesPerPage === format.flow.stagesPerPage &&
        page.lineGapMm === format.page.lineGapMm &&
        page.stageGapMm === format.page.stageGapMm &&
        page.topMm === format.page.topMm &&
        page.bottomMm === format.page.bottomMm &&
        page.innerMm === format.page.innerMm &&
        page.outerMm === format.page.outerMm)
    );
  }, "A5 and A6 use their fixed page formats"),
);

/**
 * Every value that changes placement or physical size. Zoom and UI selection live in the app.
 */
export type NovelCompositionSettings = v.InferOutput<typeof NovelCompositionSettingsSchema>;

export const NovelCompositionSettings = {
  schema: NovelCompositionSettingsSchema,

  defaults: {
    flow: NovelFlowSettings.defaults,
    offsets: ManuscriptOffsets.defaults,
    appearance: ManuscriptAppearanceSettings.defaults,
    page: ManuscriptPageSettings.defaults,
  } as const satisfies NovelCompositionSettings,

  /**
   * Select the fixed A5 or A6 format, or centre the current grid on another paper size.
   */
  forPaper: (
    paperSize: PaperSizeId,
    settings: NovelCompositionSettings,
  ): NovelCompositionSettings => {
    const appearance = { ...settings.appearance, paperSize };
    const format = paperSize === "a5" ? A5_PAGE_FORMAT : paperSize === "a6" ? A6_PAGE_FORMAT : null;
    if (format !== null)
      return {
        ...settings,
        flow: format.flow,
        appearance: { ...appearance, fontSizeQ: format.fontSizeQ },
        page: format.page,
      };
    return {
      ...settings,
      appearance,
      page: ManuscriptPageSettings.centered(settings.flow, appearance),
    };
  },

  is: (value: unknown): value is NovelCompositionSettings =>
    v.is(NovelCompositionSettingsSchema, value),
} as const;
