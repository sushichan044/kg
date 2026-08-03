import * as v from "valibot";

import type { ManuscriptAppearanceSettings } from "../appearance/appearance-settings";
import { FontSizePt } from "../appearance/font-size-pt";
import { mmToPt, ptToMm } from "../appearance/length";
import { PaperSize } from "../appearance/paper-size";
import type { PaperSizeId } from "../appearance/paper-size-id";
import { readonlyObject } from "../internal/schema";
import type { GridSettings } from "./grid-settings";

const STAGE_GAP_CELLS = 2;
const LINE_GAP_CELLS = 0.5;

const nonNegativeLength = () => v.pipe(v.number(), v.finite(), v.minValue(0));

const ManuscriptGeometrySchema = readonlyObject({
  paperWidthMm: nonNegativeLength(),
  paperHeightMm: nonNegativeLength(),
  cellSizeMm: nonNegativeLength(),
  lineGapMm: nonNegativeLength(),
  fontSizePt: FontSizePt.schema,
  gridWidthMm: nonNegativeLength(),
  gridHeightMm: nonNegativeLength(),
  marginInlineMm: v.pipe(v.number(), v.finite()),
  marginBlockMm: v.pipe(v.number(), v.finite()),
  fitsPaper: v.boolean(),
});

/**
 * Physical millimetres for one page, derived from the grid shape and the appearance settings.
 */
export type ManuscriptGeometry = v.InferOutput<typeof ManuscriptGeometrySchema>;

/**
 * Every stage stacked vertically, plus the gap between adjacent stages.
 */
function gridHeightInCells(grid: GridSettings): number {
  return grid.stagesPerPage * grid.charsPerLine + STAGE_GAP_CELLS * (grid.stagesPerPage - 1);
}

/**
 * Every vertical line side by side, plus the gap between adjacent lines.
 */
function gridWidthInCells(grid: GridSettings): number {
  return grid.linesPerStage + LINE_GAP_CELLS * (grid.linesPerStage - 1);
}

export const ManuscriptGeometry = {
  schema: ManuscriptGeometrySchema,

  of: (grid: GridSettings, appearance: ManuscriptAppearanceSettings): ManuscriptGeometry => {
    const paper = PaperSize.of(appearance.paperSize);
    const cellSizeMm = ptToMm(appearance.fontSizePt);
    const gridWidthMm = gridWidthInCells(grid) * cellSizeMm;
    const gridHeightMm = gridHeightInCells(grid) * cellSizeMm;
    const marginInlineMm = (paper.widthMm - gridWidthMm) / 2;
    const marginBlockMm = (paper.heightMm - gridHeightMm) / 2;

    return {
      paperWidthMm: paper.widthMm,
      paperHeightMm: paper.heightMm,
      cellSizeMm,
      lineGapMm: LINE_GAP_CELLS * cellSizeMm,
      fontSizePt: appearance.fontSizePt,
      gridWidthMm,
      gridHeightMm,
      marginInlineMm,
      marginBlockMm,
      fitsPaper: marginInlineMm >= 0 && marginBlockMm >= 0,
    };
  },

  /**
   * The largest step-aligned point size whose grid still fits the paper, clamped to the range.
   */
  maxFontSizePt: (grid: GridSettings, paperSizeId: PaperSizeId): number => {
    const paper = PaperSize.of(paperSizeId);
    const maxCellSizeMm = Math.min(
      paper.widthMm / gridWidthInCells(grid),
      paper.heightMm / gridHeightInCells(grid),
    );
    const steps = Math.floor(mmToPt(maxCellSizeMm) / FontSizePt.range.step + 1e-9);
    const aligned = Math.round(steps * FontSizePt.range.step * 1000) / 1000;

    return Math.min(FontSizePt.range.max, Math.max(FontSizePt.range.min, aligned));
  },
} as const;
