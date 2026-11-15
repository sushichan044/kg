import { NovelCompositionSettings } from "@sushichan044/kg-core";
import type { NovelComposedManuscript } from "@sushichan044/kg-core";
import { createDefaultProofreadingRules, proofreadManuscript } from "@sushichan044/kg-core/lint";
import { expect, test as base } from "vite-plus/test";

import { composeSource } from "./manuscript";
import { createProofreader, SUPERSEDED } from "./proofreader";
import type { Proofreader } from "./proofreader";

const sampleSource = [
  "　静かな机に、原稿用紙を広げた。",
  "「これでいいのかな？」",
  "直すべき段落はここにある。",
  "「三点リーダーが奇数………。」",
  "　数字は2026年のままになっている。",
].join("\n");

function compose(source: string): NovelComposedManuscript {
  const result = composeSource(source, NovelCompositionSettings.defaults, "kakuyomu");
  expect.assert(result.ok);
  return result.value.composed;
}

function proofreadSync(composed: NovelComposedManuscript) {
  return proofreadManuscript(composed, { rules: createDefaultProofreadingRules() });
}

const test = base.extend<{ proofreader: Proofreader }>({
  proofreader: async ({}, use) => {
    const worker = new Worker(new URL("./proofread.worker.ts", import.meta.url), {
      type: "module",
    });
    const proofreader = createProofreader(worker);
    await use(proofreader);
    proofreader[Symbol.dispose]();
  },
});

test("the composed manuscript survives structured clone unchanged", () => {
  const composed = compose(sampleSource);

  const cloned = structuredClone(composed);

  expect(cloned).toEqual(composed);
});

test("returns the same result as the synchronous proofreading", async ({ proofreader }) => {
  const composed = compose(sampleSource);
  const expected = proofreadSync(composed);
  expect.assert(expected.ok);
  expect(expected.value.length).toBeGreaterThan(0);

  const outcome = await proofreader.proofread(composed);

  expect(outcome).toEqual(expected);
});

test("discards the result of a request that a newer one superseded", async ({ proofreader }) => {
  const first = compose(sampleSource);
  const second = compose("　数字は2026年と２０２６年が混じっている。");
  const expected = proofreadSync(second);

  const [staleOutcome, latestOutcome] = await Promise.all([
    proofreader.proofread(first),
    proofreader.proofread(second),
  ]);

  expect(staleOutcome).toBe(SUPERSEDED);
  expect(latestOutcome).toEqual(expected);
});

test("reports a worker failure as a failed outcome", async ({ proofreader }) => {
  const uncloneable = { ...compose(sampleSource), notClonable: () => {} };

  const outcome = await proofreader.proofread(uncloneable);

  expect.assert(outcome !== SUPERSEDED);
  expect.assert(!outcome.ok);
  expect(outcome.error.kind).toBe("WorkerFailed");
});
