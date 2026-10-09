import * as v from "valibot";
import { describe, expect, test } from "vite-plus/test";

import { MeasurementRequest } from "./measurement-request";
import type { MeasurementRequest as Request } from "./measurement-request";
import { RunMeasurement } from "./run-measurement";

const request = (text: string): Request => ({
  text,
  kind: "base",
  presentation: "sideways",
  fontPreset: "mincho",
  fontSizePt: 12,
  scale: 1,
  writingMode: "vertical-rl",
});

const cluster = (start: number, end: number, offsetEm: number, advanceEm: number) => ({
  textRange: { start, end },
  layoutSpan: { offsetEm, advanceEm },
  renderSpan: { offsetEm: offsetEm - 0.1, advanceEm: advanceEm + 0.2 },
});

describe("run measurement boundary", () => {
  test("accepts a shared ligature with overlapping and overhanging render spans", () => {
    const input = {
      kind: "clustered",
      advanceEm: 2,
      clusters: [cluster(0, 2, 0, 1), cluster(2, 3, 1, 1)],
    };

    const measured = RunMeasurement.parseFor(request("ffi"), input);

    expect(measured).toEqual(input);
  });

  test.each([
    ["missing text", "ffi", [cluster(0, 2, 0, 2)]],
    ["overlapping text", "ffi", [cluster(0, 2, 0, 1), cluster(1, 3, 1, 1)]],
    ["reversed text", "ffi", [cluster(1, 3, 0, 1), cluster(0, 1, 1, 1)]],
    ["empty text interval", "ffi", [cluster(0, 0, 0, 1), cluster(0, 3, 1, 1)]],
    ["split surrogate", "𠮷字", [cluster(0, 1, 0, 1), cluster(1, 3, 1, 1)]],
    ["split combining grapheme", "が字", [cluster(0, 1, 0, 1), cluster(1, 3, 1, 1)]],
    ["layout gap", "ffi", [cluster(0, 2, 0, 1), cluster(2, 3, 1.5, 0.5)]],
    ["layout overlap", "ffi", [cluster(0, 2, 0, 1), cluster(2, 3, 0.5, 1.5)]],
    ["wrong total", "ffi", [cluster(0, 3, 0, 1)]],
    ["negative advance", "ffi", [cluster(0, 3, 0, -2)]],
    [
      "non-finite render offset",
      "ffi",
      [{ ...cluster(0, 3, 0, 2), renderSpan: { offsetEm: Number.NaN, advanceEm: 2 } }],
    ],
  ])("rejects %s", (_, text, clusters) => {
    const input = { kind: "clustered", advanceEm: 2, clusters };

    const measured = RunMeasurement.parseFor(request(text), input);

    expect(measured).toBeUndefined();
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    "rejects aggregate advance %s",
    (advanceEm) => {
      const measured = RunMeasurement.parseFor(request("ffi"), { kind: "advance", advanceEm });

      expect(measured).toBeUndefined();
    },
  );

  test.each([0, -1, Number.NaN])("rejects invalid scale %s", (scale) => {
    const result = v.safeParse(MeasurementRequest.schema, { ...request("ffi"), scale });

    expect(result.success).toBe(false);
  });
});
