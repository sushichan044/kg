import { ManuscriptResult, NovelCompositionSettings } from "@sushichan044/kg-core";
import { expect, test as base, vi } from "vite-plus/test";

import { createManuscriptPipeline } from "./manuscript-pipeline";
import type { ManuscriptPipeline } from "./manuscript-pipeline";

const { proofread } = vi.hoisted(() => ({ proofread: vi.fn<(...args: unknown[]) => unknown>() }));

vi.mock("@sushichan044/kg-core/lint", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  proofreadManuscript: proofread,
}));

// Node の fetch は file: の URL を読めないので、同梱の書体をディスクから直接渡す
vi.mock("./font-files", () => ({
  loadFontFiles: async () => {
    const { readFile } = await import("node:fs/promises");
    const { ManuscriptResult } = await import("@sushichan044/kg-core");
    const data = await readFile(new URL("../assets/GenEiKoburiMin6-R.ttf", import.meta.url));
    return ManuscriptResult.succeed([{ weight: 400, data: new Uint8Array(data).buffer }]);
  },
}));

const test = base.extend<{ pipeline: ManuscriptPipeline }>({
  pipeline: async ({}, use) => {
    const pipeline = createManuscriptPipeline();
    await use(pipeline);
    pipeline.dispose();
  },
});

const genei = {
  ...NovelCompositionSettings.defaults,
  appearance: { ...NovelCompositionSettings.defaults.appearance, fontPreset: "genei-koburi" },
} as const;

test("keeps the composed manuscript when proofreading fails", async ({ pipeline }) => {
  proofread.mockReturnValue(
    ManuscriptResult.fail({
      kind: "RuleThrew",
      ruleId: "kg/example",
      cause: new Error("boom"),
    }),
  );

  const outcome = await pipeline.process({
    source: "　あいう",
    notation: "kakuyomu",
    settings: genei,
  });

  expect.assert(outcome.ok);
  expect(outcome.value.composed.parsed.source).toBe("　あいう");
  expect(outcome.value.proofreadFailure).toMatchObject({ kind: "RuleThrew" });
});
