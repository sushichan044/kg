import { ManuscriptResult, NovelCompositionSettings } from "@sushichan044/kg-core";
import { expect, test as base, vi } from "vite-plus/test";

import { createManuscriptPipeline } from "./manuscript-pipeline";
import type { ManuscriptPipeline } from "./manuscript-pipeline";

const { proofread } = vi.hoisted(() => ({ proofread: vi.fn<(...args: unknown[]) => unknown>() }));

vi.mock("@sushichan044/kg-core/lint", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  proofreadManuscript: proofread,
}));

const test = base.extend<{ pipeline: ManuscriptPipeline }>({
  pipeline: async ({}, use) => {
    const pipeline = createManuscriptPipeline();
    await use(pipeline);
    pipeline.dispose();
  },
});

const gothic = {
  ...NovelCompositionSettings.defaults,
  appearance: { ...NovelCompositionSettings.defaults.appearance, fontPreset: "gothic" },
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
    settings: gothic,
  });

  expect.assert(outcome.ok);
  expect(outcome.value.composed.parsed.source).toBe("　あいう");
  expect(outcome.value.proofreadFailure).toMatchObject({ kind: "RuleThrew" });
});
