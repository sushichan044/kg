import { expect, test as base } from "vite-plus/test";

import type { MeasurementRequest } from "./measurement-request";
import { RunMeasurement } from "./run-measurement";
import { createShapedRunMeasurer } from "./shaped-run-measurer";
import type { ShapeRequest, Shaper } from "./shaper";

type Fixtures = {
  shaped: ShapeRequest[];
  missing: Set<string>;
  shaper: Shaper;
  request: (overrides: Partial<MeasurementRequest> & { text: string }) => MeasurementRequest;
};

// 横は 0.5 em、縦は 1 em、ただし "ffi" は 1 つのリガチャとして 1.25 em
const test = base.extend<Fixtures>({
  shaped: async ({}, use) => {
    await use([]);
  },
  missing: async ({}, use) => {
    await use(new Set());
  },
  shaper: async ({ shaped, missing }, use) => {
    await use({
      hasGlyph: (codePoint) => !missing.has(String.fromCodePoint(codePoint)),
      shape: (request) => {
        shaped.push(request);
        if (request.direction === "horizontal" && request.text === "ffi")
          return [{ start: 0, end: 3, advanceEm: 1.25 }];
        const unit = request.direction === "horizontal" ? 0.5 : 1;
        return Array.from(request.text).map((character, index) => ({
          start: index,
          end: index + character.length,
          advanceEm: unit,
        }));
      },
    });
  },
  request: async ({}, use) => {
    await use((overrides) => ({
      kind: "base",
      presentation: "mixed",
      fontPreset: "mincho",
      fontSizeQ: 12,
      scale: 1,
      writingMode: "vertical-rl",
      ...overrides,
    }));
  },
});

test("shapes sideways runs horizontally and applies Western kerning", ({
  shaper,
  shaped,
  request,
}) => {
  const measurer = createShapedRunMeasurer(shaper);

  const result = measurer(request({ text: "water", presentation: "sideways", scale: 2 }));

  expect(result.advanceEm).toBeCloseTo(5, 10);
  expect(shaped).toHaveLength(1);
  expect(shaped[0]).toMatchObject({
    direction: "horizontal",
    text: "water",
    weight: 400,
    features: { kern: 1, vkrn: 0 },
  });
});

test("shapes upright runs vertically without the kern feature", ({ shaper, shaped, request }) => {
  const measurer = createShapedRunMeasurer(shaper);

  const result = measurer(request({ text: "あい", presentation: "upright", scale: 0.5 }));

  expect(result.advanceEm).toBe(1);
  expect(shaped).toHaveLength(1);
  expect(shaped[0]?.direction).toBe("vertical");
  expect(shaped[0]?.features).not.toHaveProperty("kern");
});

test("shapes ruby vertically even when its presentation is sideways", ({
  shaper,
  shaped,
  request,
}) => {
  const measurer = createShapedRunMeasurer(shaper);

  const result = measurer(
    request({ kind: "ruby", presentation: "sideways", text: "ruby", scale: 0.5 }),
  );

  expect(result.advanceEm).toBe(2);
  expect(shaped.map(({ direction }) => direction)).toEqual(["vertical"]);
});

test("splits mixed runs by resolved orientation and keeps adjacent sideways graphemes together", ({
  shaper,
  shaped,
  request,
}) => {
  const measurer = createShapedRunMeasurer(shaper);

  const result = measurer(request({ text: "あabい" }));

  expect(shaped.map(({ text, direction }) => [text, direction])).toEqual([
    ["あ", "vertical"],
    ["ab", "horizontal"],
    ["い", "vertical"],
  ]);
  expect(result.advanceEm).toBe(3);
  expect(result.kind).toBe("clustered");
  expect(RunMeasurement.parseFor(request({ text: "あabい" }), result)).toBeDefined();
});

test("keeps a ligature as one cluster", ({ shaper, request }) => {
  const measurer = createShapedRunMeasurer(shaper);
  const input = request({ text: "ffi", presentation: "sideways" });

  const result = measurer(input);

  expect(result.advanceEm).toBe(1.25);
  expect(RunMeasurement.parseFor(input, result)).toEqual(result);
  expect(result.kind === "clustered" && result.clusters).toHaveLength(1);
});

test.for(["あ‌い", "あ゙い"])(
  "merges shaped clusters that split a grapheme in %j",
  (text, { shaper, request }) => {
    const measurer = createShapedRunMeasurer(shaper);
    const input = request({ text, presentation: "upright" });

    const result = measurer(input);

    expect(result.advanceEm).toBe(3);
    expect(RunMeasurement.parseFor(input, result)).toEqual(result);
    expect(
      result.kind === "clustered" && result.clusters.map(({ textRange }) => textRange.end),
    ).toEqual([2, 3]);
  },
);

test("measures tate-chu-yoko as one em without shaping", ({ shaper, shaped, request }) => {
  const measurer = createShapedRunMeasurer(shaper);

  const result = measurer(request({ text: "12", presentation: "tate-chu-yoko", scale: 0.5 }));

  expect(result).toEqual({ kind: "advance", advanceEm: 0.5 });
  expect(shaped).toHaveLength(0);
});

test("falls back to the logical width for graphemes missing from the font", ({
  shaper,
  missing,
  shaped,
  request,
}) => {
  missing.add("😀");
  const measurer = createShapedRunMeasurer(shaper);
  const input = request({ text: "あ😀い", presentation: "upright" });

  const result = measurer(input);

  expect(result.advanceEm).toBe(3);
  expect(shaped.map(({ text }) => text)).toEqual(["あ", "い"]);
  expect(RunMeasurement.parseFor(input, result)).toBeDefined();
  expect(result.kind === "clustered" && result.clusters[1]?.textRange).toEqual({
    start: 1,
    end: 3,
  });
});

test("gives graphemes missing from the font a full-width advance in ruby", ({
  shaper,
  missing,
  request,
}) => {
  missing.add("ｱ");
  const measurer = createShapedRunMeasurer(shaper);
  const input = request({ kind: "ruby", text: "あｱい", scale: 0.5 });

  const result = measurer(input);

  expect(result.advanceEm).toBeCloseTo(1.5, 10);
  expect(RunMeasurement.parseFor(input, result)).toBeDefined();
  expect(result.kind === "clustered" && result.clusters[1]?.layoutSpan).toEqual({
    offsetEm: 0.5,
    advanceEm: 0.5,
  });
});

test("uses the logical measurer for presets that do not need shaping", ({
  shaper,
  shaped,
  request,
}) => {
  const measurer = createShapedRunMeasurer(shaper);

  const result = measurer(request({ text: "あい", fontPreset: "gothic" }));

  expect(result).toEqual({ kind: "advance", advanceEm: 2 });
  expect(shaped).toHaveLength(0);
});

test("passes the requested weight to the shaper", ({ shaper, shaped, request }) => {
  const measurer = createShapedRunMeasurer(shaper);

  measurer(
    request({ text: "あ", presentation: "upright", style: { weight: 700, slant: "normal" } }),
  );

  expect(shaped[0]?.weight).toBe(700);
});

test("returns zero for empty text", ({ shaper, request }) => {
  const measurer = createShapedRunMeasurer(shaper);

  expect(measurer(request({ text: "" }))).toEqual({ kind: "advance", advanceEm: 0 });
});
