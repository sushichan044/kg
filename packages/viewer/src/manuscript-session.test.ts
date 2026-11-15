import { ManuscriptResult, NovelCompositionSettings } from "@sushichan044/kg-core";
import { expect, test as base, vi } from "vite-plus/test";

import type { ManuscriptEngine } from "./manuscript-engine";
import type { ManuscriptInput, ManuscriptOutcome } from "./manuscript-pipeline";
import { ManuscriptSession } from "./manuscript-session";
import type { RenderTypography } from "./typography";

const typography: RenderTypography = {
  fontPreset: "gothic",
  fontFamily: "sans-serif",
  fontFaces: [],
  dispose: () => {},
};

const input = (source: string): ManuscriptInput => ({
  source,
  notation: "kakuyomu",
  settings: NovelCompositionSettings.defaults,
});

// 結果の中身は使わないので、source だけを持つ組版結果に見立てる
function succeed(source: string): ManuscriptOutcome {
  return ManuscriptResult.succeed({
    composed: { parsed: { source } } as never,
    diagnostics: [],
    proofreadFailure: null,
  });
}

type Pending = Readonly<{
  input: ManuscriptInput;
  resolve: (outcome: ManuscriptOutcome) => void;
}>;

type Fixture = Readonly<{
  session: ManuscriptSession;
  started: Pending[];
  disconnect: () => void;
}>;

const test = base.extend<Fixture>({
  started: async ({}, use) => {
    await use([]);
  },
  session: async ({}, use) => {
    await use(
      new ManuscriptSession({
        loadRenderTypography: () => Promise.resolve(ManuscriptResult.succeed(typography)),
      }),
    );
  },
  disconnect: [
    async ({ session, started }, use) => {
      const engine: ManuscriptEngine = {
        process: (request) =>
          new Promise((resolve) => {
            started.push({ input: request, resolve });
          }),
        dispose: () => {},
      };
      const disconnect = session.connect(engine);
      await use(disconnect);
      disconnect();
    },
    { auto: true },
  ],
});

const sources = (started: readonly Pending[]) => started.map(({ input: { source } }) => source);

const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

test("computes only the first and the latest of requests sent while one is running", async ({
  session,
  started,
}) => {
  session.request(input("a"));
  session.request(input("b"));
  session.request(input("c"));
  session.request(input("d"));

  expect(sources(started)).toEqual(["a"]);
  started[0]?.resolve(succeed("a"));
  await vi.waitFor(() => {
    expect(sources(started)).toEqual(["a", "d"]);
  });
});

test("keeps the previous output and stays pending until the latest request settles", async ({
  session,
  started,
}) => {
  session.request(input("a"));
  started[0]?.resolve(succeed("a"));
  await vi.waitFor(() => {
    expect(session.getSnapshot().output?.composed.parsed.source).toBe("a");
  });

  session.request(input("b"));

  expect(session.getSnapshot()).toMatchObject({ pending: true, failure: null });
  expect(session.getSnapshot().output?.composed.parsed.source).toBe("a");
  started[1]?.resolve(succeed("b"));
  await vi.waitFor(() => {
    expect(session.getSnapshot().pending).toBe(false);
  });
  expect(session.getSnapshot().output?.composed.parsed.source).toBe("b");
});

test("reports a failure of the latest request without dropping the previous output", async ({
  session,
  started,
}) => {
  session.request(input("a"));
  started[0]?.resolve(succeed("a"));
  await vi.waitFor(() => {
    expect(session.getSnapshot().output).not.toBeNull();
  });

  session.request(input("b"));
  started[1]?.resolve(ManuscriptResult.fail({ stage: "worker", message: "boom" }));

  await vi.waitFor(() => {
    expect(session.getSnapshot().failure).toEqual({ stage: "worker", message: "boom" });
  });
  expect(session.getSnapshot()).toMatchObject({ pending: false });
  expect(session.getSnapshot().output?.composed.parsed.source).toBe("a");
});

test("retries the latest input after a failure", async ({ session, started }) => {
  session.request(input("a"));
  started[0]?.resolve(ManuscriptResult.fail({ stage: "worker", message: "boom" }));
  await vi.waitFor(() => {
    expect(session.getSnapshot().failure).not.toBeNull();
  });

  session.retry();
  await vi.waitFor(() => {
    expect(started).toHaveLength(2);
  });
  started[1]?.resolve(succeed("a"));

  await vi.waitFor(() => {
    expect(session.getSnapshot()).toMatchObject({ pending: false, failure: null });
  });
});

test("ignores a request equal to the latest one", async ({ session, started }) => {
  session.request(input("a"));
  session.request({ ...input("a"), settings: { ...NovelCompositionSettings.defaults } });
  await settled();

  expect(started).toHaveLength(1);
});

test("drops the result of a run that finished after disconnecting", async ({
  session,
  started,
  disconnect,
}) => {
  session.request(input("a"));

  disconnect();
  started[0]?.resolve(succeed("a"));
  await settled();

  expect(session.getSnapshot().output).toBeNull();
});
