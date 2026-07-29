import type { GridSettings } from "./pagination";

export const PAPER_SIZES = [
  { id: "a4", label: "A4", widthMm: 210, heightMm: 297 },
  { id: "a5", label: "A5", widthMm: 148, heightMm: 210 },
  { id: "jis-b5", label: "B5（JIS）", widthMm: 182, heightMm: 257 },
  { id: "jis-b6", label: "B6（JIS）", widthMm: 128, heightMm: 182 },
] as const;

export type PaperSizeId = (typeof PAPER_SIZES)[number]["id"];

export const MARGIN_OPTIONS = [10, 15, 20, 25, 30] as const;
export type MarginMm = (typeof MARGIN_OPTIONS)[number];

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

export interface ManuscriptAppearanceSettings {
  paperSize: PaperSizeId;
  marginMm: MarginMm;
  fontPreset: FontPresetId;
}

export const DEFAULT_APPEARANCE: ManuscriptAppearanceSettings = {
  paperSize: "a5",
  marginMm: 20,
  fontPreset: "mincho",
};

const DEFAULT_PAPER_SIZE =
  PAPER_SIZES.find((paper) => paper.id === DEFAULT_APPEARANCE.paperSize) ?? PAPER_SIZES[0];

export const ZOOM_LEVELS = [50, 75, 100, 125, 150] as const;
export type FixedZoomPercent = (typeof ZOOM_LEVELS)[number];
export type ZoomMode = { mode: "fixed"; percent: FixedZoomPercent } | { mode: "fit" };
export const DEFAULT_ZOOM: ZoomMode = { mode: "fixed", percent: 100 };

const STAGE_GAP_CELLS = 2;
const FONT_TO_CELL_RATIO = 0.82;
const CSS_PIXELS_PER_MM = 96 / 25.4;
const MAX_FIT_PERCENT = Math.max(...ZOOM_LEVELS);

export interface ManuscriptGeometry {
  paperWidthMm: number;
  paperHeightMm: number;
  cellSizeMm: number;
  fontSizePt: number;
}

export function paperSize(id: PaperSizeId) {
  return PAPER_SIZES.find((paper) => paper.id === id) ?? DEFAULT_PAPER_SIZE;
}

export function fontPreset(id: FontPresetId) {
  return FONT_PRESETS.find((font) => font.id === id) ?? FONT_PRESETS[0];
}

export function calculateManuscriptGeometry(
  settings: GridSettings,
  appearance: ManuscriptAppearanceSettings,
): ManuscriptGeometry {
  const paper = paperSize(appearance.paperSize);
  const availableWidthMm = paper.widthMm - 2 * appearance.marginMm;
  const availableHeightMm = paper.heightMm - 2 * appearance.marginMm;
  const gridHeightInCells =
    settings.stagesPerPage * settings.charsPerLine + STAGE_GAP_CELLS * (settings.stagesPerPage - 1);
  const cellSizeMm = Math.min(
    availableWidthMm / settings.linesPerStage,
    availableHeightMm / gridHeightInCells,
  );

  return {
    paperWidthMm: paper.widthMm,
    paperHeightMm: paper.heightMm,
    cellSizeMm,
    fontSizePt: (cellSizeMm * FONT_TO_CELL_RATIO * 72) / 25.4,
  };
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

export function isMarginMm(value: unknown): value is MarginMm {
  return MARGIN_OPTIONS.some((margin) => margin === value);
}

export function isFontPresetId(value: unknown): value is FontPresetId {
  return FONT_PRESETS.some((font) => font.id === value);
}

export function isFixedZoomPercent(value: unknown): value is FixedZoomPercent {
  return ZOOM_LEVELS.some((percent) => percent === value);
}
