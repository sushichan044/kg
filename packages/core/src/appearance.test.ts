import { describe, expect, test } from "vite-plus/test";

import {
  calculateManuscriptGeometry,
  FONT_SIZE_PT_RANGE,
  isFontSizePt,
  isPaperSizeId,
  maxFontSizePt,
  mmToPt,
  paperSize,
  ptToMm,
} from "./appearance";
import type { ManuscriptAppearanceSettings, PaperSizeId } from "./appearance";
import type { GridSettings } from "./pagination";

const settings: GridSettings = { charsPerLine: 20, linesPerStage: 15, stagesPerPage: 2 };

function appearance(
  fontSizePt: number,
  paperSizeId: PaperSizeId = "a5",
): ManuscriptAppearanceSettings {
  return { paperSize: paperSizeId, fontSizePt, fontPreset: "mincho" };
}

describe("ptToMm / mmToPt", () => {
  test("round-trips using 72pt = 25.4mm", () => {
    expect(ptToMm(72)).toBeCloseTo(25.4, 10);
    expect(mmToPt(25.4)).toBeCloseTo(72, 10);
    expect(mmToPt(ptToMm(10))).toBeCloseTo(10, 10);
  });
});

describe("calculateManuscriptGeometry", () => {
  test("derives cell size in millimeters directly from the specified point size", () => {
    const geometry = calculateManuscriptGeometry(settings, appearance(10));
    expect(geometry.cellSizeMm).toBeCloseTo(ptToMm(10), 10);
    expect(geometry.fontSizePt).toBe(10);
  });

  test("computes grid dimensions and centers the grid within the paper as margins", () => {
    const geometry = calculateManuscriptGeometry(settings, appearance(9, "a5"));
    const cellSizeMm = ptToMm(9);
    const expectedLineGap = cellSizeMm * 0.5;
    const expectedGridWidth =
      settings.linesPerStage * cellSizeMm + (settings.linesPerStage - 1) * expectedLineGap;
    const expectedGridHeight =
      (settings.stagesPerPage * settings.charsPerLine + 2 * (settings.stagesPerPage - 1)) *
      cellSizeMm;
    const paper = paperSize("a5");

    expect(geometry.gridWidthMm).toBeCloseTo(expectedGridWidth, 10);
    expect(geometry.lineGapMm).toBeCloseTo(expectedLineGap, 10);
    expect(geometry.gridHeightMm).toBeCloseTo(expectedGridHeight, 10);
    expect(geometry.marginInlineMm).toBeCloseTo((paper.widthMm - expectedGridWidth) / 2, 10);
    expect(geometry.marginBlockMm).toBeCloseTo((paper.heightMm - expectedGridHeight) / 2, 10);
    expect(geometry.fitsPaper).toBe(true);
  });

  test.each([
    ["a6", "A6（文庫）", 105, 148],
    ["shinsho", "新書", 106, 173],
  ] as const)("supports the %s book format", (id, label, widthMm, heightMm) => {
    expect(paperSize(id)).toEqual({ id, label, widthMm, heightMm });
    expect(isPaperSizeId(id)).toBe(true);
  });

  test("reports fitsPaper: false and negative margins without clamping an oversized font", () => {
    const oversized: GridSettings = { charsPerLine: 40, linesPerStage: 40, stagesPerPage: 3 };
    const geometry = calculateManuscriptGeometry(oversized, appearance(24, "jis-b6"));

    expect(geometry.fitsPaper).toBe(false);
    expect(geometry.marginInlineMm < 0 || geometry.marginBlockMm < 0).toBe(true);
    // The requested point size is reported as-is; it is never silently shrunk to fit.
    expect(geometry.fontSizePt).toBe(24);
    expect(geometry.cellSizeMm).toBeCloseTo(ptToMm(24), 10);
  });
});

describe("maxFontSizePt", () => {
  test("returns the largest step-aligned point size that fits; one step above does not", () => {
    const paperSizeId: PaperSizeId = "a5";
    const maxPt = maxFontSizePt(settings, paperSizeId);

    const fits = calculateManuscriptGeometry(settings, appearance(maxPt, paperSizeId));
    const oneStepAbove = calculateManuscriptGeometry(
      settings,
      appearance(maxPt + FONT_SIZE_PT_RANGE.step, paperSizeId),
    );

    expect(fits.fitsPaper).toBe(true);
    expect(oneStepAbove.fitsPaper).toBe(false);
  });

  test("aligns the returned value to FONT_SIZE_PT_RANGE.step", () => {
    const maxPt = maxFontSizePt(settings, "a4");
    const steps = maxPt / FONT_SIZE_PT_RANGE.step;

    expect(steps).toBeCloseTo(Math.round(steps), 9);
  });

  test("clamps to FONT_SIZE_PT_RANGE.max when a sparse grid would otherwise fit an oversized font", () => {
    const sparse: GridSettings = { charsPerLine: 10, linesPerStage: 10, stagesPerPage: 1 };
    const maxPt = maxFontSizePt(sparse, "a4");

    expect(maxPt).toBe(FONT_SIZE_PT_RANGE.max);
    expect(isFontSizePt(maxPt)).toBe(true);
  });

  test("clamps to FONT_SIZE_PT_RANGE.min when a dense grid would otherwise compute below it", () => {
    const dense: GridSettings = { charsPerLine: 60, linesPerStage: 60, stagesPerPage: 3 };
    const maxPt = maxFontSizePt(dense, "jis-b6");

    expect(maxPt).toBe(FONT_SIZE_PT_RANGE.min);
    expect(isFontSizePt(maxPt)).toBe(true);
  });
});

describe("isFontSizePt", () => {
  test("rejects a value within range but not aligned to the 0.5pt step", () => {
    expect(isFontSizePt(9.3)).toBe(false);
  });

  test("accepts a value aligned to the 0.5pt step", () => {
    expect(isFontSizePt(9.5)).toBe(true);
  });

  test("rejects values outside the min/max range", () => {
    expect(isFontSizePt(FONT_SIZE_PT_RANGE.min - FONT_SIZE_PT_RANGE.step)).toBe(false);
    expect(isFontSizePt(FONT_SIZE_PT_RANGE.max + FONT_SIZE_PT_RANGE.step)).toBe(false);
  });

  test("rejects non-numbers and non-finite values", () => {
    expect(isFontSizePt("10")).toBe(false);
    expect(isFontSizePt(Number.NaN)).toBe(false);
    expect(isFontSizePt(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
