import * as v from "valibot";

import type { ManuscriptAppearanceSettings } from "../appearance/appearance-settings";
import { FontSizePt } from "../appearance/font-size-pt";
import { mmToPt, ptToMm } from "../appearance/length";
import { PaperSize } from "../appearance/paper-size";
import type { PaperSizeId } from "../appearance/paper-size-id";
import { readonlyObject } from "../internal/schema";
import type { NovelFlowSettings } from "./novel-flow-settings";

const STAGE_GAP_CELLS = 2;
const LINE_GAP_CELLS = 0.5;

const nonNegativeLength = () => v.pipe(v.number(), v.finite(), v.minValue(0));

const ManuscriptGeometrySchema = readonlyObject({
  paperWidthMm: nonNegativeLength(),
  paperHeightMm: nonNegativeLength(),
  cellSizeMm: nonNegativeLength(),
  lineGapMm: nonNegativeLength(),
  fontSizePt: FontSizePt.schema,
  contentWidthMm: nonNegativeLength(),
  contentHeightMm: nonNegativeLength(),
  marginInlineMm: v.pipe(v.number(), v.finite()),
  marginBlockMm: v.pipe(v.number(), v.finite()),
  fitsPaper: v.boolean(),
});

/**
 * Physical millimetres for one page, derived from the text flow and appearance settings. The
 * content box is the 基本版面 — the text area a Japanese page format is designed around — and it is
 * centred on the paper, so the margins fall out of the paper size rather than being chosen.
 *
 * `fitsPaper` is false when the requested grid is larger than the paper. The geometry is still
 * returned in full so a caller can show what overflowed instead of being handed nothing.
 */
export type ManuscriptGeometry = v.InferOutput<typeof ManuscriptGeometrySchema>;

/**
 * Every stage stacked vertically, plus the gap between adjacent stages.
 */
function contentHeightInEm(flow: NovelFlowSettings): number {
  return flow.stagesPerPage * flow.lineLengthEm + STAGE_GAP_CELLS * (flow.stagesPerPage - 1);
}

/**
 * Every vertical line side by side, plus the gap between adjacent lines.
 */
function contentWidthInEm(flow: NovelFlowSettings): number {
  return flow.linesPerStage + LINE_GAP_CELLS * (flow.linesPerStage - 1);
}

export const ManuscriptGeometry = {
  schema: ManuscriptGeometrySchema,

  of: (flow: NovelFlowSettings, appearance: ManuscriptAppearanceSettings): ManuscriptGeometry => {
    const paper = PaperSize.of(appearance.paperSize);
    const cellSizeMm = ptToMm(appearance.fontSizePt);
    const contentWidthMm = contentWidthInEm(flow) * cellSizeMm;
    const contentHeightMm = contentHeightInEm(flow) * cellSizeMm;
    const marginInlineMm = (paper.widthMm - contentWidthMm) / 2;
    const marginBlockMm = (paper.heightMm - contentHeightMm) / 2;

    return {
      paperWidthMm: paper.widthMm,
      paperHeightMm: paper.heightMm,
      cellSizeMm,
      lineGapMm: LINE_GAP_CELLS * cellSizeMm,
      fontSizePt: appearance.fontSizePt,
      contentWidthMm,
      contentHeightMm,
      marginInlineMm,
      marginBlockMm,
      fitsPaper: marginInlineMm >= 0 && marginBlockMm >= 0,
    };
  },

  /**
   * The largest step-aligned point size whose text area still fits the paper.
   */
  maxFontSizePt: (flow: NovelFlowSettings, paperSizeId: PaperSizeId): number => {
    const paper = PaperSize.of(paperSizeId);
    const maxCellSizeMm = Math.min(
      paper.widthMm / contentWidthInEm(flow),
      paper.heightMm / contentHeightInEm(flow),
    );
    const steps = Math.floor(mmToPt(maxCellSizeMm) / FontSizePt.range.step + 1e-9);
    const aligned = Math.round(steps * FontSizePt.range.step * 1000) / 1000;

    return Math.min(FontSizePt.range.max, Math.max(FontSizePt.range.min, aligned));
  },
} as const;
