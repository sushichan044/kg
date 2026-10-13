import * as v from "valibot";

import type { ManuscriptAppearanceSettings } from "../appearance/appearance-settings";
import { FontSizeQ } from "../appearance/font-size-q";
import { PaperSize } from "../appearance/paper-size";
import { readonlyObject } from "../internal/schema";
import type { NovelFlowSettings } from "./novel-flow-settings";
import { ManuscriptPageSettings } from "./page-settings";

const length = () => v.pipe(v.number(), v.finite(), v.minValue(0));
const ManuscriptGeometrySchema = readonlyObject({
  ...ManuscriptPageSettings.schema.entries,
  paperWidthMm: length(),
  paperHeightMm: length(),
  cellSizeMm: length(),
  fontSizeQ: FontSizeQ.schema,
  contentWidthMm: length(),
  contentHeightMm: length(),
});

/**
 * Physical page dimensions. The renderer mirrors inner and outer margins on alternate pages.
 */
export type ManuscriptGeometry = v.InferOutput<typeof ManuscriptGeometrySchema>;

export const ManuscriptGeometry = {
  schema: ManuscriptGeometrySchema,
  of: (
    flow: NovelFlowSettings,
    appearance: ManuscriptAppearanceSettings,
    page: ManuscriptPageSettings,
  ): ManuscriptGeometry => {
    const paper = PaperSize.of(appearance.paperSize);
    const cellSizeMm = appearance.fontSizeQ / 4;
    return {
      ...page,
      paperWidthMm: paper.widthMm,
      paperHeightMm: paper.heightMm,
      cellSizeMm,
      fontSizeQ: appearance.fontSizeQ,
      contentWidthMm: flow.linesPerStage * cellSizeMm + (flow.linesPerStage - 1) * page.lineGapMm,
      contentHeightMm:
        flow.stagesPerPage * flow.lineLengthEm * cellSizeMm +
        (flow.stagesPerPage - 1) * page.stageGapMm,
    };
  },
} as const;
