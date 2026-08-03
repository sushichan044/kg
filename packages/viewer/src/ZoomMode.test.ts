import { describe, expect, test } from "vite-plus/test";

import { ZOOM_LEVELS, ZoomMode } from "./ZoomMode";

describe("adjacentLevel", () => {
  test("steps to the neighbouring level of the built-in scale", () => {
    expect(ZoomMode.adjacentLevel(100, "in")).toBe(125);
    expect(ZoomMode.adjacentLevel(100, "out")).toBe(75);
  });

  test("steps from a magnification that is not on the scale", () => {
    expect(ZoomMode.adjacentLevel(90, "in")).toBe(100);
    expect(ZoomMode.adjacentLevel(90, "out")).toBe(75);
  });

  test("reports the ends of the scale", () => {
    expect(ZoomMode.adjacentLevel(Math.max(...ZOOM_LEVELS), "in")).toBeNull();
    expect(ZoomMode.adjacentLevel(Math.min(...ZOOM_LEVELS), "out")).toBeNull();
  });

  test("steps through a scale of the caller's own, whatever order it comes in", () => {
    const levels = [400, 200, 25];

    expect(ZoomMode.adjacentLevel(100, "in", levels)).toBe(200);
    expect(ZoomMode.adjacentLevel(100, "out", levels)).toBe(25);
    expect(ZoomMode.adjacentLevel(400, "in", levels)).toBeNull();
  });
});

describe("fitPagePercent", () => {
  test("fits the page to whichever viewport axis is tighter", () => {
    // A5 portrait: 148mm × 210mm, 1mm = 96/25.4 px.
    const perMm = 96 / 25.4;

    expect(ZoomMode.fitPagePercent(148 * perMm, 420 * perMm, 148, 210)).toBeCloseTo(100, 0);
    expect(ZoomMode.fitPagePercent(296 * perMm, 105 * perMm, 148, 210)).toBeCloseTo(50, 0);
  });

  test("keeps growing a page that has room to spare, leaving any ceiling to the caller", () => {
    const perMm = 96 / 25.4;

    expect(ZoomMode.fitPagePercent(2100 * perMm, 2100 * perMm, 148, 210)).toBeCloseTo(1000, 0);
  });

  test("falls back to full size before the viewport has been measured", () => {
    expect(ZoomMode.fitPagePercent(0, 0, 148, 210)).toBe(100);
  });
});
