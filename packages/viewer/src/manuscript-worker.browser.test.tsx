import { NovelCompositionSettings } from "@sushichan044/kg-core";
import type { FontPresetId } from "@sushichan044/kg-core";
import { expect, test as base, vi } from "vite-plus/test";
import { renderHook } from "vitest-browser-react";

import { createMainThreadEngine, createWorkerEngine } from "./manuscript-engine";
import type { ManuscriptEngine } from "./manuscript-engine";
import type { ManuscriptInput } from "./manuscript-pipeline";
import type { ManuscriptOutput } from "./manuscript-session";
import { ManuscriptSession } from "./manuscript-session";
import { useManuscript } from "./use-manuscript";
import type { UseManuscriptOptions } from "./use-manuscript";

const createWorker = () =>
  new Worker(new URL("./fixtures/kg.worker.ts", import.meta.url), { type: "module" });

// 読み込みに失敗する Worker は、error イベントだけを発火する
const createBrokenWorker = () => new Worker("/kg-missing.worker.js", { type: "module" });

const samples = {
  prose: [
    "　静かな机に、原稿用紙を広げた。",
    "「これでいいのかな？」",
    "吾輩は[[rb:猫>ねこ]]である。名前はまだ無い。",
    "「三点リーダーが奇数………。」",
    "　数字は2026年のままになっている。",
  ].join("\n"),
  western: "Hello, world―ｱ🦄が゙12officeで終わる。どこで生れたかとんと見当がつかぬ。",
} as const;

const fonts = ["mincho", "genei-koburi"] as const satisfies readonly FontPresetId[];

function inputFor(source: string, fontPreset: FontPresetId): ManuscriptInput {
  return {
    source,
    notation: "pixiv",
    settings: {
      ...NovelCompositionSettings.defaults,
      appearance: { ...NovelCompositionSettings.defaults.appearance, fontPreset },
    },
  };
}

type Fixture = Readonly<{ workerEngine: ManuscriptEngine; mainEngine: ManuscriptEngine }>;

const test = base.extend<Fixture>({
  workerEngine: async ({}, use) => {
    const engine = createWorkerEngine(createWorker);
    await use(engine);
    engine.dispose();
  },
  mainEngine: async ({}, use) => {
    const engine = createMainThreadEngine();
    await use(engine);
    engine.dispose();
  },
});

const cases = fonts.flatMap((font) =>
  Object.entries(samples).map(([name, source]) => ({ font, name, source })),
);

test.for(cases)(
  "composes and proofreads like the main thread ($font, $name)",
  async ({ font, source }, { workerEngine, mainEngine }) => {
    const request = inputFor(source, font);

    const viaWorker = await workerEngine.process(request);
    const direct = await mainEngine.process(request);

    expect.assert(direct.ok);
    expect.assert(viaWorker.ok);
    expect(direct.value.diagnostics.length).toBeGreaterThan(0);
    expect(viaWorker.value).toEqual(direct.value);
  },
);

test("reports a parse failure from the worker", async ({ workerEngine }) => {
  const outcome = await workerEngine.process({
    ...inputFor("a", "mincho"),
    settings: {
      ...NovelCompositionSettings.defaults,
      flow: { ...NovelCompositionSettings.defaults.flow, lineLengthEm: 0 },
    },
  });

  expect.assert(!outcome.ok);
  expect(outcome.error.stage).toBe("compose");
});

test("fails pending requests when the worker cannot be loaded", async () => {
  const engine = createWorkerEngine(createBrokenWorker());

  const outcome = await engine.process(inputFor("あ", "mincho"));

  expect.assert(!outcome.ok);
  expect(outcome.error.stage).toBe("worker");
  const again = await engine.process(inputFor("あ", "mincho"));
  expect.assert(!again.ok);
  expect(again.error.stage).toBe("worker");
  engine.dispose();
});

test("creates a new worker for the next request after the worker died", async () => {
  const created = vi.fn<() => Worker>();
  created.mockImplementationOnce(createBrokenWorker).mockImplementation(createWorker);
  const engine = createWorkerEngine(created);

  const failed = await engine.process(inputFor("あ", "mincho"));
  const recovered = await engine.process(inputFor("あ", "mincho"));

  expect.assert(!failed.ok);
  expect(failed.error.stage).toBe("worker");
  expect(recovered.ok).toBe(true);
  expect(created).toHaveBeenCalledTimes(2);
  engine.dispose();
});

test("creates a new worker for the next request after a message error stopped the worker", async () => {
  const workers: Worker[] = [];
  const created = vi.fn<() => Worker>(() => {
    const worker = createWorker();
    workers.push(worker);
    return worker;
  });
  const engine = createWorkerEngine(created);
  const first = await engine.process(inputFor("あ", "mincho"));
  expect.assert(first.ok);

  workers[0]?.dispatchEvent(new MessageEvent("messageerror"));
  const recovered = await engine.process(inputFor("あ", "mincho"));

  expect(recovered.ok).toBe(true);
  expect(created).toHaveBeenCalledTimes(2);
  engine.dispose();
});

test("computes only the first and the latest of rapid inputs in the worker", async ({
  workerEngine,
}) => {
  const processed: string[] = [];
  const counting: ManuscriptEngine = {
    process: (request) => {
      processed.push(request.source);
      return workerEngine.process(request);
    },
    dispose: () => {},
  };
  const session = new ManuscriptSession();
  const disconnect = session.connect(counting);

  for (const source of ["あ", "あい", "あいう", "あいうえ", "あいうえお"])
    session.request(inputFor(source, "mincho"));

  await vi.waitFor(
    () => {
      expect(session.getSnapshot().pending).toBe(false);
    },
    { timeout: 10_000 },
  );
  disconnect();
  expect(processed).toEqual(["あ", "あいうえお"]);
  expect(session.getSnapshot().output?.composed.parsed.source).toBe("あいうえお");
});

// 診断は、同じ結果の組版から作られているので、表示中の原稿の範囲を超えない
function expectDiagnosticsWithin(output: ManuscriptOutput | null) {
  expect.assert(output !== null);
  for (const { range } of output.diagnostics) {
    expect(range.source.end).toBeLessThanOrEqual(output.composed.parsed.source.length);
    expect(range.graphemes.end).toBeLessThanOrEqual(output.composed.parsed.graphemes.length);
  }
}

type HookProps = UseManuscriptOptions;

async function renderManuscript(initial: HookProps) {
  const { result, rerender } = await renderHook(
    (props?: HookProps) => useManuscript(props ?? initial),
    {
      initialProps: initial,
    },
  );
  return { current: () => result.current, rerender: (props: HookProps) => rerender(props) };
}

// 先に登録した listener が Worker の返信を止め、release で同じ data を届け直す
function holdReplies(worker: Worker) {
  let held: unknown[] | null = null;
  worker.addEventListener("message", (event) => {
    if (held === null) return;
    event.stopImmediatePropagation();
    held.push(event.data);
  });
  return {
    hold: () => {
      held = [];
    },
    release: () => {
      const replies = held ?? [];
      held = null;
      for (const data of replies) worker.dispatchEvent(new MessageEvent("message", { data }));
    },
  };
}

test("keeps the previous output while the worker composes the next one", async () => {
  const worker = createWorker();
  const replies = holdReplies(worker);
  const base = { ...inputFor(samples.prose, "mincho"), worker };
  const hook = await renderManuscript(base);
  await vi.waitFor(
    () => {
      expect(hook.current().output).not.toBeNull();
    },
    { timeout: 10_000 },
  );
  const first = hook.current().output;
  replies.hold();

  await hook.rerender({ ...base, source: "あ" });

  expect(hook.current().output).toBe(first);
  expectDiagnosticsWithin(hook.current().output);
  expect(hook.current().pending).toBe(true);
  replies.release();
  await vi.waitFor(
    () => {
      expect(hook.current().pending).toBe(false);
    },
    { timeout: 10_000 },
  );
  expect(hook.current().output?.composed.parsed.source).toBe("あ");
  expectDiagnosticsWithin(hook.current().output);
  worker.terminate();
});

test("composes on the main thread without a worker", async () => {
  const hook = await renderManuscript(inputFor(samples.prose, "mincho"));

  await vi.waitFor(
    () => {
      expect(hook.current().output?.diagnostics.length).toBeGreaterThan(0);
    },
    { timeout: 10_000 },
  );
  expect(hook.current().pending).toBe(false);
});

test("reports a dead worker and keeps the previous output", async () => {
  const worker = createWorker();
  const base = { ...inputFor(samples.prose, "mincho"), worker };
  const hook = await renderManuscript(base);
  await vi.waitFor(
    () => {
      expect(hook.current().output).not.toBeNull();
    },
    { timeout: 10_000 },
  );
  const first = hook.current().output;

  worker.dispatchEvent(new ErrorEvent("error", { message: "boom" }));
  await hook.rerender({ ...base, source: "あ" });

  await vi.waitFor(() => {
    expect(hook.current().failure).toEqual({
      stage: "worker",
      message: "The worker is no longer available",
    });
  });
  expect(hook.current().pending).toBe(false);
  expect(hook.current().output).toBe(first);
  worker.terminate();
});
