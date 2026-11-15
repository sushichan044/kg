import { NovelCompositionSettings } from "@sushichan044/kg-core";
import type { NovelComposedManuscript } from "@sushichan044/kg-core";
import { expect, test as base, vi } from "vite-plus/test";
import { renderHook } from "vitest-browser-react";

import { composeSource } from "./manuscript";
import { useProofreading } from "./useProofreading";

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

async function renderProofreading(initial: NovelComposedManuscript) {
  const { result, rerender } = await renderHook(
    (composed?: NovelComposedManuscript) => useProofreading(composed ?? null),
    { initialProps: initial },
  );
  return {
    current: () => result.current,
    rerender: (composed: NovelComposedManuscript) => rerender(composed),
  };
}

const waitForStatus = (current: () => { status: string }, status: string) =>
  vi.waitFor(
    () => {
      expect(current().status).toBe(status);
    },
    { timeout: 10000 },
  );

const RealWorker = Worker;

const test = base.extend<{ failNextRequests: (count: number) => void }>({
  failNextRequests: async ({}, use) => {
    let failures = 0;
    vi.stubGlobal(
      "Worker",
      class extends RealWorker {
        override postMessage(
          message: unknown,
          transfer?: Transferable[] | StructuredSerializeOptions,
        ) {
          if (failures > 0) {
            failures -= 1;
            queueMicrotask(() => {
              this.dispatchEvent(new ErrorEvent("error", { message: "boom" }));
            });
            return;
          }
          super.postMessage(message, transfer as StructuredSerializeOptions);
        }
      },
    );
    await use((count) => {
      failures = count;
    });
    vi.unstubAllGlobals();
  },
});

test("keeps the previous proofreading diagnostics until the next result arrives", async () => {
  const hook = await renderProofreading(compose(sampleSource));
  await waitForStatus(hook.current, "ready");
  const ready = hook.current();
  expect.assert(ready.status === "ready");
  expect(ready.diagnostics.length).toBeGreaterThan(0);

  await hook.rerender(compose(`${sampleSource}\n追加の一行。`));

  const pending = hook.current();
  expect.assert(pending.status === "pending");
  expect(pending.previous).toEqual(ready.diagnostics);
  await waitForStatus(hook.current, "ready");
});

test("drops previous diagnostics whose range exceeds the new manuscript", async () => {
  const hook = await renderProofreading(compose(sampleSource));
  await waitForStatus(hook.current, "ready");
  const ready = hook.current();
  expect.assert(ready.status === "ready");
  const shorter = compose("あ");

  await hook.rerender(shorter);

  const pending = hook.current();
  expect.assert(pending.status === "pending");
  expect(pending.previous.length).toBeLessThan(ready.diagnostics.length);
  for (const { range } of pending.previous) {
    expect(range.source.end).toBeLessThanOrEqual(shorter.parsed.source.length);
    expect(range.graphemes.end).toBeLessThanOrEqual(shorter.parsed.graphemes.length);
  }
});

test("reports a failure and retries on the next input", async ({ failNextRequests }) => {
  failNextRequests(1);
  const hook = await renderProofreading(compose(sampleSource));
  await waitForStatus(hook.current, "failed");

  await hook.rerender(compose(`${sampleSource}\n追加の一行。`));

  await waitForStatus(hook.current, "ready");
});
