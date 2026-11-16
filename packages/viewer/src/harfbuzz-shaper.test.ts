import { readFile } from "node:fs/promises";

import * as hb from "harfbuzzjs";
import { expect, test as base } from "vite-plus/test";

import { createHarfBuzzShaper } from "./harfbuzz-shaper";
import type { HarfBuzzShaper } from "./harfbuzz-shaper";

const read = async (name: string) =>
  new Uint8Array(await readFile(new URL(`../assets/${name}`, import.meta.url)));

const test = base.extend<{ genei: Uint8Array; shaper: HarfBuzzShaper }>({
  genei: async ({}, use) => {
    await use(await read("GenEiKoburiMin6-R.ttf"));
  },
  shaper: async ({ genei }, use) => {
    const shaper = await createHarfBuzzShaper([{ weight: 400, data: genei }]);
    try {
      await use(shaper);
    } finally {
      shaper.dispose();
    }
  },
});

test("harfbuzzjs ignores vmtx, so the adapter reads it itself", async ({ genei, shaper }) => {
  const raw = new hb.Buffer();
  raw.addText(" ");
  raw.setDirection(hb.Direction.TTB);
  raw.setLanguage("ja");
  hb.shape(new hb.Font(new hb.Face(new hb.Blob(genei))), raw);

  const [position] = raw.getGlyphPositions();
  const [cluster] = shaper.shape({ text: " ", direction: "vertical", weight: 400, features: {} });

  expect(position?.yAdvance).toBe(-1024);
  expect(cluster?.advanceEm).toBe(340 / 1024);
});

test("shapes vertical text on a one-em pitch for CJK characters", ({ shaper }) => {
  const clusters = shaper.shape({
    text: "あ漢、",
    direction: "vertical",
    weight: 400,
    features: { vkrn: 0, vhal: 0, vpal: 0 },
  });

  expect(clusters.map(({ start, end, advanceEm }) => [start, end, advanceEm])).toEqual([
    [0, 1, 1],
    [1, 2, 1],
    [2, 3, 1],
  ]);
});

test("shapes horizontal text with ligatures as one cluster", ({ shaper }) => {
  const clusters = shaper.shape({
    text: "office",
    direction: "horizontal",
    weight: 400,
    features: { liga: 1 },
  });

  expect(clusters.reduce((total, { advanceEm }) => total + advanceEm, 0)).toBe(2733 / 1024);
  expect(clusters.at(-1)?.end).toBe(6);
  expect(clusters.some(({ start, end }) => end - start === 3)).toBe(true);
});

test("reports glyph coverage from the cmap", ({ shaper }) => {
  expect(shaper.hasGlyph("あ".codePointAt(0) ?? 0, 400)).toBe(true);
  expect(shaper.hasGlyph("😀".codePointAt(0) ?? 0, 400)).toBe(false);
});

test("rejects shaping after dispose", async ({ genei }) => {
  const shaper = await createHarfBuzzShaper([{ weight: 400, data: genei }]);

  shaper.dispose();

  expect(() =>
    shaper.shape({ text: "a", direction: "horizontal", weight: 400, features: {} }),
  ).toThrow("disposed");
});
