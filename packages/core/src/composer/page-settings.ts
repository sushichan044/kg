import * as v from "valibot";

import { A5_PAGE_FORMAT } from "../appearance/a5-page-format";
import type { ManuscriptAppearanceSettings } from "../appearance/appearance-settings";
import { PaperSize } from "../appearance/paper-size";
import { readonlyObject } from "../internal/schema";
import type { NovelFlowSettings } from "./novel-flow-settings";

const length = () => v.pipe(v.number(), v.finite(), v.minValue(0));
const ManuscriptPageSettingsSchema = readonlyObject({
  lineGapMm: length(),
  stageGapMm: length(),
  topMm: length(),
  bottomMm: length(),
  innerMm: length(),
  outerMm: length(),
});

export type ManuscriptPageSettings = v.InferOutput<typeof ManuscriptPageSettingsSchema>;

export const ManuscriptPageSettings = {
  schema: ManuscriptPageSettingsSchema,
  defaults: A5_PAGE_FORMAT.page,

  /**
   * Centre a non-A5 text grid using half-cell line gaps and two-cell stage gaps.
   */
  centered: (
    flow: NovelFlowSettings,
    appearance: ManuscriptAppearanceSettings,
  ): ManuscriptPageSettings => {
    const cell = appearance.fontSizeQ / 4;
    const paper = PaperSize.of(appearance.paperSize);
    const lineGapMm = cell / 2;
    const stageGapMm = cell * 2;
    const horizontal =
      (paper.widthMm - flow.linesPerStage * cell - (flow.linesPerStage - 1) * lineGapMm) / 2;
    const vertical =
      (paper.heightMm -
        flow.stagesPerPage * flow.lineLengthEm * cell -
        (flow.stagesPerPage - 1) * stageGapMm) /
      2;

    return {
      lineGapMm,
      stageGapMm,
      topMm: vertical,
      bottomMm: vertical,
      innerMm: horizontal,
      outerMm: horizontal,
    };
  },
} as const;
