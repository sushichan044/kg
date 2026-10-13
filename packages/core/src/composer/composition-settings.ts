import * as v from "valibot";

import { A5_PAGE_FORMAT } from "../appearance/a5-page-format";
import { ManuscriptAppearanceSettings } from "../appearance/appearance-settings";
import type { PaperSizeId } from "../appearance/paper-size-id";
import { readonlyObject } from "../internal/schema";
import { LineOffset } from "./line-offset";
import { ManuscriptGeometry } from "./manuscript-geometry";
import { ManuscriptOffsets } from "./manuscript-offsets";
import { NovelFlowSettings } from "./novel-flow-settings";
import { ManuscriptPageSettings } from "./page-settings";

const NovelCompositionSettingsSchema = v.pipe(
  readonlyObject({
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
  v.check(
    ({ flow, appearance, page }) =>
      appearance.paperSize !== "a5" ||
      (appearance.fontSizeQ === A5_PAGE_FORMAT.fontSizeQ &&
        flow.lineLengthEm === A5_PAGE_FORMAT.flow.lineLengthEm &&
        flow.linesPerStage === A5_PAGE_FORMAT.flow.linesPerStage &&
        flow.stagesPerPage === A5_PAGE_FORMAT.flow.stagesPerPage &&
        page.lineGapMm === A5_PAGE_FORMAT.page.lineGapMm &&
        page.stageGapMm === A5_PAGE_FORMAT.page.stageGapMm &&
        page.topMm === A5_PAGE_FORMAT.page.topMm &&
        page.bottomMm === A5_PAGE_FORMAT.page.bottomMm &&
        page.innerMm === A5_PAGE_FORMAT.page.innerMm &&
        page.outerMm === A5_PAGE_FORMAT.page.outerMm),
    "A5 uses the fixed 12.7Q, 27-character, 23-line, two-stage format",
  ),
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
   * Select the fixed A5 format, or centre the current grid on another paper size.
   */
  forPaper: (
    paperSize: PaperSizeId,
    settings: NovelCompositionSettings,
  ): NovelCompositionSettings => {
    const appearance = { ...settings.appearance, paperSize };
    if (paperSize === "a5")
      return {
        ...settings,
        flow: A5_PAGE_FORMAT.flow,
        appearance: { ...appearance, fontSizeQ: A5_PAGE_FORMAT.fontSizeQ },
        page: A5_PAGE_FORMAT.page,
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
