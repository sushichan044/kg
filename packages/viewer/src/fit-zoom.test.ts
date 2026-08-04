import { expect, test } from "vite-plus/test";

import { fitZoom } from "./fit-zoom";

const perMm = 96 / 25.4;
const options = {
  viewportWidthPx: 148 * perMm,
  viewportHeightPx: 150 * perMm,
  paperWidthMm: 148,
  paperHeightMm: 210,
  min: 50,
  max: 150,
  step: 25,
} as const;

test("rounds a fitting zoom down to the configured step", () => {
  const result = fitZoom(options);

  expect(result).toBe(50);
});

test.each([
  ["a non-finite minimum", { min: Number.NaN }],
  ["a minimum below one percent", { min: 0 }],
  ["a non-finite maximum", { max: Number.POSITIVE_INFINITY }],
  ["a maximum below the minimum", { max: 49 }],
  ["a zero step", { step: 0 }],
  ["a non-finite step", { step: Number.POSITIVE_INFINITY }],
])("rejects %s", (_description, override) => {
  const invalidOptions = { ...options, ...override };

  const calculateFitZoom = () => fitZoom(invalidOptions);

  expect(calculateFitZoom).toThrowError(RangeError);
});

test("keeps fit zoom within its configured range", () => {
  const largeViewport = {
    ...options,
    viewportWidthPx: 2100 * perMm,
    viewportHeightPx: 2100 * perMm,
  };

  const result = fitZoom(largeViewport);

  expect(result).toBe(150);
});
