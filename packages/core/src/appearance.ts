import type { GridSettings } from "./pagination";

export const PAPER_SIZES = [
  { id: "a4", label: "A4", widthMm: 210, heightMm: 297 },
  { id: "a5", label: "A5", widthMm: 148, heightMm: 210 },
  { id: "jis-b5", label: "B5（JIS）", widthMm: 182, heightMm: 257 },
  { id: "jis-b6", label: "B6（JIS）", widthMm: 128, heightMm: 182 },
] as const;

export type PaperSizeId = (typeof PAPER_SIZES)[number]["id"];

export const FONT_PRESETS = [
  {
    id: "mincho",
    label: "明朝",
    family: '"Yu Mincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", serif',
  },
  {
    id: "gothic",
    label: "ゴシック",
    family: '"Yu Gothic", "Hiragino Kaku Gothic ProN", system-ui, sans-serif',
  },
] as const;

export type FontPresetId = (typeof FONT_PRESETS)[number]["id"];

export const FONT_SIZE_PT_RANGE = { min: 6, max: 24, step: 0.5 } as const;

export interface ManuscriptAppearanceSettings {
  paperSize: PaperSizeId;
  fontSizePt: number;
  fontPreset: FontPresetId;
}

export const DEFAULT_APPEARANCE = {
  paperSize: "a5",
  fontSizePt: 9,
  fontPreset: "mincho",
} as const satisfies ManuscriptAppearanceSettings;

const DEFAULT_PAPER_SIZE =
  PAPER_SIZES.find((paper) => paper.id === DEFAULT_APPEARANCE.paperSize) ?? PAPER_SIZES[0];

export const ZOOM_LEVELS = [50, 75, 100, 125, 150] as const;
export type FixedZoomPercent = (typeof ZOOM_LEVELS)[number];
export type ZoomMode = { mode: "fixed"; percent: FixedZoomPercent } | { mode: "fit" };
export const DEFAULT_ZOOM = { mode: "fixed", percent: 100 } as const satisfies ZoomMode;

const STAGE_GAP_CELLS = 2;
const CSS_PIXELS_PER_MM = 96 / 25.4;
const MAX_FIT_PERCENT = Math.max(...ZOOM_LEVELS);
const PT_PER_MM = 72 / 25.4;

export interface ManuscriptGeometry {
  paperWidthMm: number;
  paperHeightMm: number;
  cellSizeMm: number;
  fontSizePt: number;
  gridWidthMm: number;
  gridHeightMm: number;
  marginInlineMm: number;
  marginBlockMm: number;
  fitsPaper: boolean;
}

export function paperSize(id: PaperSizeId) {
  return PAPER_SIZES.find((paper) => paper.id === id) ?? DEFAULT_PAPER_SIZE;
}

export function fontPreset(id: FontPresetId) {
  return FONT_PRESETS.find((font) => font.id === id) ?? FONT_PRESETS[0];
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

export function calculateManuscriptGeometry(
  settings: GridSettings,
  appearance: ManuscriptAppearanceSettings,
): ManuscriptGeometry {
  const paper = paperSize(appearance.paperSize);
  const cellSizeMm = ptToMm(appearance.fontSizePt);
  const gridWidthMm = settings.linesPerStage * cellSizeMm;
  const gridHeightMm = gridHeightInCells(settings) * cellSizeMm;
  const marginInlineMm = (paper.widthMm - gridWidthMm) / 2;
  const marginBlockMm = (paper.heightMm - gridHeightMm) / 2;

  return {
    paperWidthMm: paper.widthMm,
    paperHeightMm: paper.heightMm,
    cellSizeMm,
    fontSizePt: appearance.fontSizePt,
    gridWidthMm,
    gridHeightMm,
    marginInlineMm,
    marginBlockMm,
    fitsPaper: marginInlineMm >= 0 && marginBlockMm >= 0,
  };
}

/**
 * The largest font size, in `FONT_SIZE_PT_RANGE.step` increments, whose grid still fits the paper.
 */
export function maxFontSizePt(settings: GridSettings, paperSizeId: PaperSizeId): number {
  const paper = paperSize(paperSizeId);
  const maxCellSizeMm = Math.min(
    paper.widthMm / settings.linesPerStage,
    paper.heightMm / gridHeightInCells(settings),
  );
  const maxPt = mmToPt(maxCellSizeMm);
  const steps = Math.floor(maxPt / FONT_SIZE_PT_RANGE.step + 1e-9);

  return Math.round(steps * FONT_SIZE_PT_RANGE.step * 1000) / 1000;
}

export function fitPagePercent(
  viewportWidthPx: number,
  viewportHeightPx: number,
  paperWidthMm: number,
  paperHeightMm: number,
): number {
  if (viewportWidthPx <= 0 || viewportHeightPx <= 0) {
    return 100;
  }
  const widthScale = viewportWidthPx / (paperWidthMm * CSS_PIXELS_PER_MM);
  const heightScale = viewportHeightPx / (paperHeightMm * CSS_PIXELS_PER_MM);

  return Math.min(widthScale * 100, heightScale * 100, MAX_FIT_PERCENT);
}

export function adjacentZoomLevel(
  effectivePercent: number,
  direction: "in" | "out",
): FixedZoomPercent | null {
  const levels = direction === "in" ? ZOOM_LEVELS : [...ZOOM_LEVELS].reverse();

  return (
    levels.find((level) =>
      direction === "in" ? level > effectivePercent : level < effectivePercent,
    ) ?? null
  );
}

export function isPaperSizeId(value: unknown): value is PaperSizeId {
  return PAPER_SIZES.some((paper) => paper.id === value);
}

export function isFontSizePt(value: unknown): value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < FONT_SIZE_PT_RANGE.min ||
    value > FONT_SIZE_PT_RANGE.max
  ) {
    return false;
  }
  const steps = (value - FONT_SIZE_PT_RANGE.min) / FONT_SIZE_PT_RANGE.step;

  return Math.abs(steps - Math.round(steps)) < 1e-9;
}

export function isFontPresetId(value: unknown): value is FontPresetId {
  return FONT_PRESETS.some((font) => font.id === value);
}

export function isFixedZoomPercent(value: unknown): value is FixedZoomPercent {
  return ZOOM_LEVELS.some((percent) => percent === value);
}
