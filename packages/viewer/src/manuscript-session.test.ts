import { ManuscriptResult, NovelCompositionSettings } from "@sushichan044/kg-core";
import { expect, test as base, vi } from "vite-plus/test";

import type { ManuscriptEngine } from "./manuscript-engine";
import type { ManuscriptInput, ManuscriptOutcome } from "./manuscript-pipeline";
import { ManuscriptSession } from "./manuscript-session";
import type { RenderTypography } from "./typography";

type LoadedTypography = RenderTypography & Readonly<{ isDisposed: () => boolean }>;

function loadTypography(): LoadedTypography {
  let disposed = false;
  return {
    fontPreset: "gothic",
    fontFamily: "sans-serif",
    fontFaces: [],
    dispose: () => {
      disposed = true;
    },
    isDisposed: () => disposed,
  };
}

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
  loaded: LoadedTypography[];
  createEngine: () => ManuscriptEngine;
  disconnect: () => void;
}>;

const test = base.extend<Fixture>({
  started: async ({}, use) => {
    await use([]);
  },
  loaded: async ({}, use) => {
    await use([]);
  },
  session: async ({ loaded }, use) => {
    await use(
      new ManuscriptSession({
        loadRenderTypography: () => {
          const typography = loadTypography();
          loaded.push(typography);
          return Promise.resolve(ManuscriptResult.succeed(typography));
        },
      }),
    );
  },
  createEngine: async ({ started }, use) => {
    await use(() => ({
      process: (request) =>
        new Promise((resolve) => {
          started.push({ input: request, resolve });
        }),
      dispose: () => {},
    }));
  },
  disconnect: [
    async ({ session, createEngine }, use) => {
      const disconnect = session.connect(createEngine());
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

test("reprocesses the latest input with new typography after reconnecting", async ({
  session,
  started,
  loaded,
  createEngine,
  disconnect,
}) => {
  session.request(input("a"));
  started[0]?.resolve(succeed("a"));
  await vi.waitFor(() => {
    expect(session.getSnapshot().output).not.toBeNull();
  });

  disconnect();
  const reconnected = session.connect(createEngine());

  expect(sources(started)).toEqual(["a", "a"]);
  expect(session.getSnapshot().pending).toBe(true);
  started[1]?.resolve(succeed("a"));
  await vi.waitFor(() => {
    expect(session.getSnapshot().pending).toBe(false);
  });
  const typography = session.getSnapshot().output?.typography;
  expect.assert(typography !== undefined);
  expect(typography).toBe(loaded[1]);
  expect(loaded[1]?.isDisposed()).toBe(false);
  reconnected();
});

test("reprocesses a failed input after reconnecting", async ({
  session,
  started,
  createEngine,
  disconnect,
}) => {
  session.request(input("a"));
  started[0]?.resolve(ManuscriptResult.fail({ stage: "worker", message: "boom" }));
  await vi.waitFor(() => {
    expect(session.getSnapshot().failure).not.toBeNull();
  });

  disconnect();
  const reconnected = session.connect(createEngine());
  started[1]?.resolve(succeed("a"));

  await vi.waitFor(() => {
    expect(session.getSnapshot()).toMatchObject({ pending: false, failure: null });
  });
  expect(session.getSnapshot().output?.composed.parsed.source).toBe("a");
  reconnected();
});

test("keeps the font load of a new connection when a load from the previous one fails", async ({
  createEngine,
}) => {
  const failures: Array<() => void> = [];
  const loaded: LoadedTypography[] = [];
  const session = new ManuscriptSession({
    loadRenderTypography: () => {
      if (failures.length === 0)
        return new Promise((_, reject) => {
          failures.push(() => {
            reject(new Error("font unavailable"));
          });
        });
      const typography = loadTypography();
      loaded.push(typography);
      return Promise.resolve(ManuscriptResult.succeed(typography));
    },
  });
  const disconnect = session.connect(createEngine());
  session.request(input("a"));
  disconnect();
  const reconnected = session.connect(createEngine());
  await settled();
  expect.assert(loaded.length === 1);

  failures[0]?.();
  await settled();
  reconnected();
  await settled();

  expect(loaded[0]?.isDisposed()).toBe(true);
});

test("keeps the displayed typography after reconnecting until a replacement output is published", async ({
  session,
  started,
  loaded,
  createEngine,
  disconnect,
}) => {
  session.request(input("a"));
  started[0]?.resolve(succeed("a"));
  await vi.waitFor(() => {
    expect(session.getSnapshot().output).not.toBeNull();
  });

  disconnect();
  const reconnected = session.connect(createEngine());
  started[1]?.resolve(ManuscriptResult.fail({ stage: "worker", message: "boom" }));
  await vi.waitFor(() => {
    expect(session.getSnapshot().failure).not.toBeNull();
  });

  expect(session.getSnapshot().output?.typography).toBe(loaded[0]);
  expect(loaded[0]?.isDisposed()).toBe(false);
  session.retry();
  started[2]?.resolve(succeed("a"));
  await vi.waitFor(() => {
    expect(session.getSnapshot().output?.typography).toBe(loaded[1]);
  });
  expect(loaded[0]?.isDisposed()).toBe(true);
  reconnected();
});

test("disposes the displayed typography when the session stays disconnected", async ({
  session,
  started,
  loaded,
  disconnect,
}) => {
  session.request(input("a"));
  started[0]?.resolve(succeed("a"));
  await vi.waitFor(() => {
    expect(session.getSnapshot().output).not.toBeNull();
  });

  disconnect();
  await settled();

  expect(loaded[0]?.isDisposed()).toBe(true);
});
