import * as v from "valibot";

import type { GridSettings } from "./pagination";
export const PaperSizeIdSchema = v.picklist(["a4", "a5", "a6", "jis-b5", "jis-b6", "shinsho"]);
export type PaperSizeId = v.InferOutput<typeof PaperSizeIdSchema>;

export const PAPER_SIZES = {
  a4: { id: "a4", label: "A4", widthMm: 210, heightMm: 297 },
  a5: { id: "a5", label: "A5", widthMm: 148, heightMm: 210 },
  a6: { id: "a6", label: "A6（文庫）", widthMm: 105, heightMm: 148 },
  "jis-b5": { id: "jis-b5", label: "B5（JIS）", widthMm: 182, heightMm: 257 },
  "jis-b6": { id: "jis-b6", label: "B6（JIS）", widthMm: 128, heightMm: 182 },
  shinsho: { id: "shinsho", label: "新書", widthMm: 106, heightMm: 173 },
} as const satisfies Record<
  PaperSizeId,
  { id: PaperSizeId; label: string; widthMm: number; heightMm: number }
>;

export const FontPresetIdSchema = v.picklist(["mincho", "gothic"]);
export type FontPresetId = v.InferOutput<typeof FontPresetIdSchema>;

export const FONT_PRESETS = {
  mincho: {
    id: "mincho",
    label: "明朝",
    family: '"Yu Mincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", serif',
  },
  gothic: {
    id: "gothic",
    label: "ゴシック",
    family: '"Yu Gothic", "Hiragino Kaku Gothic ProN", system-ui, sans-serif',
  },
} as const satisfies Record<FontPresetId, { id: FontPresetId; label: string; family: string }>;

export const FONT_SIZE_PT_RANGE = { min: 6, max: 24, step: 0.5 } as const;

export const FontSizePtSchema = v.pipe(
  v.number(),
  v.finite(),
  v.minValue(FONT_SIZE_PT_RANGE.min),
  v.maxValue(FONT_SIZE_PT_RANGE.max),
  v.multipleOf(FONT_SIZE_PT_RANGE.step),
);

export const ManuscriptAppearanceSettingsSchema = v.pipe(
  v.strictObject({
    paperSize: PaperSizeIdSchema,
    fontSizePt: FontSizePtSchema,
    fontPreset: FontPresetIdSchema,
  }),
  v.readonly(),
);

export type ManuscriptAppearanceSettings = v.InferOutput<typeof ManuscriptAppearanceSettingsSchema>;

export const DEFAULT_APPEARANCE = {
  paperSize: "a5",
  fontSizePt: 9,
  fontPreset: "mincho",
} as const satisfies ManuscriptAppearanceSettings;

const STAGE_GAP_CELLS = 2;
const LINE_GAP_CELLS = 0.5;
const PT_PER_MM = 72 / 25.4;

export const ManuscriptGeometrySchema = v.pipe(
  v.strictObject({
    paperWidthMm: v.pipe(v.number(), v.finite(), v.minValue(0)),
    paperHeightMm: v.pipe(v.number(), v.finite(), v.minValue(0)),
    cellSizeMm: v.pipe(v.number(), v.finite(), v.minValue(0)),
    lineGapMm: v.pipe(v.number(), v.finite(), v.minValue(0)),
    fontSizePt: FontSizePtSchema,
    gridWidthMm: v.pipe(v.number(), v.finite(), v.minValue(0)),
    gridHeightMm: v.pipe(v.number(), v.finite(), v.minValue(0)),
    marginInlineMm: v.pipe(v.number(), v.finite()),
    marginBlockMm: v.pipe(v.number(), v.finite()),
    fitsPaper: v.boolean(),
  }),
  v.readonly(),
);

export type ManuscriptGeometry = v.InferOutput<typeof ManuscriptGeometrySchema>;

export function paperSize(id: PaperSizeId) {
  return PAPER_SIZES[id];
}

export function fontPreset(id: FontPresetId) {
  return FONT_PRESETS[id];
}

export function ptToMm(pt: number): number {
  return pt / PT_PER_MM;
}

export function mmToPt(mm: number): number {
  return mm * PT_PER_MM;
}

/**
 * The page's grid height in cells: every stage stacked vertically, plus the gap between stages.
 */
function gridHeightInCells(settings: GridSettings): number {
  return (
    settings.stagesPerPage * settings.charsPerLine + STAGE_GAP_CELLS * (settings.stagesPerPage - 1)
  );
}

/**
 * The grid's inline size in cells, including the gap between adjacent vertical lines.
 */
function gridWidthInCells(settings: GridSettings): number {
  return settings.linesPerStage + LINE_GAP_CELLS * (settings.linesPerStage - 1);
}

export function calculateManuscriptGeometry(
  settings: GridSettings,
  appearance: ManuscriptAppearanceSettings,
): ManuscriptGeometry {
  const paper = paperSize(appearance.paperSize);
  const cellSizeMm = ptToMm(appearance.fontSizePt);
  const lineGapMm = LINE_GAP_CELLS * cellSizeMm;
  const gridWidthMm = gridWidthInCells(settings) * cellSizeMm;
  const gridHeightMm = gridHeightInCells(settings) * cellSizeMm;
  const marginInlineMm = (paper.widthMm - gridWidthMm) / 2;
  const marginBlockMm = (paper.heightMm - gridHeightMm) / 2;

  return {
    paperWidthMm: paper.widthMm,
    paperHeightMm: paper.heightMm,
    cellSizeMm,
    lineGapMm,
    fontSizePt: appearance.fontSizePt,
    gridWidthMm,
    gridHeightMm,
    marginInlineMm,
    marginBlockMm,
    fitsPaper: marginInlineMm >= 0 && marginBlockMm >= 0,
  };
}

export function maxFontSizePt(settings: GridSettings, paperSizeId: PaperSizeId): number {
  const paper = paperSize(paperSizeId);
  const maxCellSizeMm = Math.min(
    paper.widthMm / gridWidthInCells(settings),
    paper.heightMm / gridHeightInCells(settings),
  );
  const maxPt = mmToPt(maxCellSizeMm);
  const steps = Math.floor(maxPt / FONT_SIZE_PT_RANGE.step + 1e-9);
  const aligned = Math.round(steps * FONT_SIZE_PT_RANGE.step * 1000) / 1000;

  return Math.min(FONT_SIZE_PT_RANGE.max, Math.max(FONT_SIZE_PT_RANGE.min, aligned));
}

export function isPaperSizeId(value: unknown): value is PaperSizeId {
  return v.is(PaperSizeIdSchema, value);
}

export function isFontSizePt(value: unknown): value is number {
  return v.is(FontSizePtSchema, value);
}

export function isFontPresetId(value: unknown): value is FontPresetId {
  return v.is(FontPresetIdSchema, value);
}
