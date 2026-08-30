import { describe, expect, test } from "vite-plus/test";

import { ManuscriptAppearanceSettings } from "../appearance/appearance-settings";
import { FontSizePt } from "../appearance/font-size-pt";
import { mmToPt, ptToMm } from "../appearance/length";
import { PaperSize } from "../appearance/paper-size";
import { PaperSizeId } from "../appearance/paper-size-id";
import { ManuscriptGeometry } from "./manuscript-geometry";
import type { NovelFlowSettings } from "./novel-flow-settings";

const settings = {
  lineLengthEm: 20,
  linesPerStage: 15,
  stagesPerPage: 2,
} as const satisfies NovelFlowSettings;

function appearance(
  fontSizePt: number,
  paperSize: PaperSizeId = "a5",
): ManuscriptAppearanceSettings {
  return { ...ManuscriptAppearanceSettings.defaults, paperSize, fontSizePt };
}

describe("ptToMm / mmToPt", () => {
  test("round-trips using 72pt = 25.4mm", () => {
    expect(ptToMm(72)).toBeCloseTo(25.4, 10);
    expect(mmToPt(25.4)).toBeCloseTo(72, 10);
    expect(mmToPt(ptToMm(10))).toBeCloseTo(10, 10);
  });
});

describe("ManuscriptGeometry.of", () => {
  test("derives cell size in millimeters directly from the specified point size", () => {
    const geometry = ManuscriptGeometry.of(settings, appearance(10));

    expect(geometry.cellSizeMm).toBeCloseTo(ptToMm(10), 10);
    expect(geometry.fontSizePt).toBe(10);
  });

  test("computes content dimensions and centers the text area within the paper", () => {
    const geometry = ManuscriptGeometry.of(settings, appearance(9, "a5"));
    const cellSizeMm = ptToMm(9);
    const expectedLineGap = cellSizeMm * 0.5;
    const expectedGridWidth =
      settings.linesPerStage * cellSizeMm + (settings.linesPerStage - 1) * expectedLineGap;
    const expectedGridHeight =
      (settings.stagesPerPage * settings.lineLengthEm + 2 * (settings.stagesPerPage - 1)) *
      cellSizeMm;
    const paper = PaperSize.of("a5");

    expect(geometry.contentWidthMm).toBeCloseTo(expectedGridWidth, 10);
    expect(geometry.lineGapMm).toBeCloseTo(expectedLineGap, 10);
    expect(geometry.contentHeightMm).toBeCloseTo(expectedGridHeight, 10);
    expect(geometry.marginInlineMm).toBeCloseTo((paper.widthMm - expectedGridWidth) / 2, 10);
    expect(geometry.marginBlockMm).toBeCloseTo((paper.heightMm - expectedGridHeight) / 2, 10);
    expect(geometry.fitsPaper).toBe(true);
  });

  test.each([
    ["a6", "A6（文庫）", 105, 148],
    ["shinsho", "新書", 106, 173],
  ] as const)("supports the %s book format", (id, label, widthMm, heightMm) => {
    expect(PaperSize.of(id)).toEqual({ id, label, widthMm, heightMm });
    expect(PaperSizeId.is(id)).toBe(true);
  });

  test("reports fitsPaper: false and negative margins without clamping an oversized font", () => {
    const oversized = {
      lineLengthEm: 40,
      linesPerStage: 40,
      stagesPerPage: 3,
    } as const satisfies NovelFlowSettings;
    const geometry = ManuscriptGeometry.of(oversized, appearance(24, "jis-b6"));

    expect(geometry.fitsPaper).toBe(false);
    expect(geometry.marginInlineMm < 0 || geometry.marginBlockMm < 0).toBe(true);
    // The requested point size is reported as-is; it is never silently shrunk to fit.
    expect(geometry.fontSizePt).toBe(24);
    expect(geometry.cellSizeMm).toBeCloseTo(ptToMm(24), 10);
  });
});

describe("ManuscriptGeometry.maxFontSizePt", () => {
  test("returns the largest step-aligned point size that fits; one step above does not", () => {
    const maxPt = ManuscriptGeometry.maxFontSizePt(settings, "a5");

    const fits = ManuscriptGeometry.of(settings, appearance(maxPt, "a5"));
    const oneStepAbove = ManuscriptGeometry.of(
      settings,
      appearance(maxPt + FontSizePt.range.step, "a5"),
    );

    expect(fits.fitsPaper).toBe(true);
    expect(oneStepAbove.fitsPaper).toBe(false);
  });

  test("aligns the returned value to the configured step", () => {
    const maxPt = ManuscriptGeometry.maxFontSizePt(settings, "a4");
    const steps = maxPt / FontSizePt.range.step;

    expect(steps).toBeCloseTo(Math.round(steps), 9);
  });

  test("clamps to the maximum when a sparse flow would otherwise fit an oversized font", () => {
    const sparse = {
      lineLengthEm: 10,
      linesPerStage: 10,
      stagesPerPage: 1,
    } as const satisfies NovelFlowSettings;
    const maxPt = ManuscriptGeometry.maxFontSizePt(sparse, "a4");

    expect(maxPt).toBe(FontSizePt.range.max);
    expect(FontSizePt.is(maxPt)).toBe(true);
  });

  test("clamps to the minimum when a dense flow would otherwise compute below it", () => {
    const dense = {
      lineLengthEm: 60,
      linesPerStage: 60,
      stagesPerPage: 3,
    } as const satisfies NovelFlowSettings;
    const maxPt = ManuscriptGeometry.maxFontSizePt(dense, "jis-b6");

    expect(maxPt).toBe(FontSizePt.range.min);
    expect(FontSizePt.is(maxPt)).toBe(true);
  });
});

describe("FontSizePt.is", () => {
  test("rejects a value within range but not aligned to the 0.5pt step", () => {
    expect(FontSizePt.is(9.3)).toBe(false);
  });

  test("accepts a value aligned to the 0.5pt step", () => {
    expect(FontSizePt.is(9.5)).toBe(true);
  });

  test("rejects values outside the min/max range", () => {
    expect(FontSizePt.is(FontSizePt.range.min - FontSizePt.range.step)).toBe(false);
    expect(FontSizePt.is(FontSizePt.range.max + FontSizePt.range.step)).toBe(false);
  });

  test("rejects non-numbers and non-finite values", () => {
    expect(FontSizePt.is("10")).toBe(false);
    expect(FontSizePt.is(Number.NaN)).toBe(false);
    expect(FontSizePt.is(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
