import { expect, test } from "vite-plus/test";

import { fitZoom } from "./fit-zoom";

const perMm = 96 / 25.4;

test("rounds a fitting zoom down to the configured step", () => {
  expect(
    fitZoom({
      viewportWidthPx: 148 * perMm,
      viewportHeightPx: 150 * perMm,
      paperWidthMm: 148,
      paperHeightMm: 210,
      min: 50,
      max: 150,
      step: 25,
    }),
  ).toBe(50);
});

test("keeps fit zoom within its configured range", () => {
  expect(
    fitZoom({
      viewportWidthPx: 2100 * perMm,
      viewportHeightPx: 2100 * perMm,
      paperWidthMm: 148,
      paperHeightMm: 210,
      min: 50,
      max: 150,
      step: 25,
    }),
  ).toBe(150);
});
