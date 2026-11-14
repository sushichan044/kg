import { FontPreset, NovelCompositionSettings, novelComposer } from "@sushichan044/kg-core";
import { logicalRunMeasurer } from "@sushichan044/kg-core/plugin";
import type { ReadyTypography } from "@sushichan044/kg-viewer";
import { expect, test as base } from "vite-plus/test";

import { processManuscript } from "./processing";
import type { ProcessingInput } from "./processing";

type Fixture = Readonly<{ input: ProcessingInput }>;

const test = base.extend<Fixture>({
  input: async ({}, use) => {
    const composition = NovelCompositionSettings.defaults;
    const typography: ReadyTypography = {
      fontFaces: [],
      fontPreset: composition.appearance.fontPreset,
      prepare: (parsed) => ({ parsed, mapRange: (range) => range }),
      fontFamily: FontPreset.of(composition.appearance.fontPreset).family,
      composer: novelComposer,
      measurer: logicalRunMeasurer,
      dispose: () => {},
    };
    await use({ source: "　正常\n問題", composition, notation: "kakuyomu", typography });
  },
});

test("proofreads in a worker and reports the diagnostics", async ({ input }) => {
  // Arrange
  const processed = processManuscript(input);
  expect.assert(processed.proofreading !== null, "composition should have succeeded");

  // Act
  const result = await processed.proofreading;

  // Assert
  expect.assert(result.kind === "done", "expected the proofreading to succeed");
  expect(result.diagnostics.map(({ origin }) => origin.id)).toContain("kg/paragraph-opening");
});

test("returns the same promise for the same input so Suspense can retry", ({ input }) => {
  // Arrange
  const first = processManuscript(input);

  // Act
  const second = processManuscript({ ...input });

  // Assert
  expect(second).toBe(first);
  expect(second.proofreading).toBe(first.proofreading);
});

test("starts over when the source changes", ({ input }) => {
  // Arrange
  const first = processManuscript(input);

  // Act
  const second = processManuscript({ ...input, source: `${input.source}。` });

  // Assert
  expect(second).not.toBe(first);
});
