import { describe, expect, test } from "vite-plus/test";

import {
  adjacentZoomLevel,
  calculateManuscriptGeometry,
  DEFAULT_APPEARANCE,
  fitPagePercent,
} from "./manuscriptAppearance";
import type { GridSettings } from "./pagination";

const defaultGrid: GridSettings = {
  charsPerLine: 27,
  linesPerStage: 23,
  stagesPerPage: 2,
};

describe("calculateManuscriptGeometry", () => {
  test("fits the largest square cells inside an A5 page with the selected minimum margin", () => {
    const geometry = calculateManuscriptGeometry(defaultGrid, DEFAULT_APPEARANCE);

    expect(geometry.paperWidthMm).toBe(148);
    expect(geometry.paperHeightMm).toBe(210);
    expect(geometry.cellSizeMm).toBeCloseTo(170 / 56);
    expect(geometry.fontSizePt).toBeCloseTo(((170 / 56) * 0.82 * 72) / 25.4);
  });

  test("uses the limiting paper dimension when the grid shape changes", () => {
    const geometry = calculateManuscriptGeometry(
      { charsPerLine: 10, linesPerStage: 60, stagesPerPage: 1 },
      DEFAULT_APPEARANCE,
    );

    expect(geometry.cellSizeMm).toBeCloseTo(108 / 60);
  });
});

describe("fitPagePercent", () => {
  test("fits both paper dimensions inside the viewport", () => {
    const percent = fitPagePercent(400, 500, 148, 210);
    const scale = percent / 100;
    const pixelsPerMm = 96 / 25.4;

    expect(148 * pixelsPerMm * scale).toBeLessThanOrEqual(400);
    expect(210 * pixelsPerMm * scale).toBeCloseTo(500);
  });

  test("caps enlargement at the largest fixed zoom level", () => {
    expect(fitPagePercent(2000, 2000, 148, 210)).toBe(150);
  });
});

describe("adjacentZoomLevel", () => {
  test("moves from a fitted percentage to the neighboring fixed levels", () => {
    expect(adjacentZoomLevel(82, "out")).toBe(75);
    expect(adjacentZoomLevel(82, "in")).toBe(100);
  });

  test("returns null at a fixed zoom boundary", () => {
    expect(adjacentZoomLevel(50, "out")).toBeNull();
    expect(adjacentZoomLevel(150, "in")).toBeNull();
  });
});
