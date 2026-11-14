import type { FontPresetId } from "@sushichan044/kg-core";
import { Activity, Suspense, useEffect, useTransition } from "react";
import { expect, test as base, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import type { ReadyTypography } from "./typography";
import { TypographyProvider } from "./TypographyProvider";
import { useTypography } from "./use-typography";

type FontRequest = {
  failed: boolean;
  calls: number;
  adds: number;
  gate: Promise<void> | undefined;
  release: () => void;
};
const test = base.extend<{ fontRequest: FontRequest }>({
  fontRequest: async ({}, use) => {
    const nativeFetch = globalThis.fetch;
    const request: FontRequest = {
      failed: false,
      calls: 0,
      adds: 0,
      gate: undefined,
      release: () => {},
    };
    const nativeAdd = document.fonts.add.bind(document.fonts);
    const add = vi.spyOn(document.fonts, "add").mockImplementation((face) => {
      request.adds += 1;
      return nativeAdd(face);
    });
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("RinMincho-Regular")) {
        request.calls += 1;
        await request.gate;
        if (request.failed) return new Response(null, { status: 503 });
      }
      return nativeFetch(input, init);
    });
    try {
      await use(request);
    } finally {
      request.release();
      add.mockRestore();
      vi.unstubAllGlobals();
    }
  },
});

function hold(request: FontRequest) {
  request.gate = new Promise<void>((resolve) => {
    request.release = resolve;
  });
}

function Probe({
  fontPreset,
  label,
  onReady,
}: Readonly<{
  fontPreset: FontPresetId;
  label: string;
  onReady?: (typography: ReadyTypography) => void;
}>) {
  const state = useTypography(fontPreset);
  const typography = state.kind === "ready" ? state.typography : undefined;
  // retry の中の startTransition はこの遷移にまとまるので、aria-busy が false に戻るのは再試行の結果が描画されたとき
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    if (typography !== undefined) onReady?.(typography);
  }, [onReady, typography]);
  if (state.kind === "failed")
    return (
      <div role="alert">
        <p>{state.error.kind}</p>
        <button
          type="button"
          aria-busy={retrying}
          onClick={() => {
            startRetry(() => {
              state.retry();
            });
          }}
        >
          retry
        </button>
      </div>
    );
  return <p data-testid={label}>{state.typography.fontPreset}</p>;
}

function Slot(props: Parameters<typeof Probe>[0]) {
  return (
    <Suspense fallback={<p role="status">loading</p>}>
      <Probe {...props} />
    </Suspense>
  );
}

test("suspends with the loading fallback until the font is ready", async ({ fontRequest }) => {
  hold(fontRequest);
  const screen = await render(
    <TypographyProvider>
      <Slot fontPreset="mincho" label="first" />
    </TypographyProvider>,
  );

  await expect.element(screen.getByRole("status")).toHaveTextContent("loading");
  expect(screen.getByTestId("first").query()).toBeNull();

  fontRequest.release();

  await expect.element(screen.getByTestId("first"), { timeout: 10000 }).toHaveTextContent("mincho");
  expect(screen.getByRole("status").query()).toBeNull();
});

test("shows a retry control after a failure and loads again on retry", async ({ fontRequest }) => {
  fontRequest.failed = true;
  const screen = await render(
    <TypographyProvider>
      <Slot fontPreset="mincho" label="first" />
    </TypographyProvider>,
  );
  await expect.element(screen.getByRole("alert")).toHaveTextContent("font-loadretry");

  fontRequest.failed = false;
  await screen.getByRole("button", { name: "retry" }).click();

  await expect.element(screen.getByTestId("first"), { timeout: 10000 }).toHaveTextContent("mincho");
  expect(fontRequest.calls).toBe(2);
});

test("loads again when a second consumer retries after another consumer's retry failed", async ({
  fontRequest,
}) => {
  fontRequest.failed = true;
  const screen = await render(
    <TypographyProvider>
      <div data-testid="first-slot">
        <Slot fontPreset="mincho" label="first" />
      </div>
      <div data-testid="second-slot">
        <Slot fontPreset="mincho" label="second" />
      </div>
    </TypographyProvider>,
  );
  const first = screen.getByTestId("first-slot");
  const second = screen.getByTestId("second-slot");
  await expect.element(first.getByRole("alert")).toBeVisible();
  await expect.element(second.getByRole("alert")).toBeVisible();
  const firstRetry = first.getByRole("button", { name: "retry" });
  await firstRetry.click();
  await expect.element(firstRetry, { timeout: 10000 }).toHaveAttribute("aria-busy", "false");
  expect(fontRequest.calls).toBe(2);
  await expect.element(first.getByRole("alert")).toBeVisible();
  fontRequest.failed = false;

  await second.getByRole("button", { name: "retry" }).click();

  await expect
    .element(screen.getByTestId("second"), { timeout: 10000 })
    .toHaveTextContent("mincho");
  expect(fontRequest.calls).toBe(3);
});

test("serves an already loaded preset without showing the fallback again", async ({
  fontRequest,
}) => {
  const screen = await render(
    <TypographyProvider>
      <Slot fontPreset="mincho" label="first" />
    </TypographyProvider>,
  );
  await expect.element(screen.getByTestId("first"), { timeout: 10000 }).toBeVisible();

  await screen.rerender(
    <TypographyProvider>
      <Slot fontPreset="mincho" label="first" />
      <Slot fontPreset="mincho" label="second" />
    </TypographyProvider>,
  );

  expect(screen.getByRole("status").query()).toBeNull();
  expect(screen.getByTestId("second").query()?.textContent).toBe("mincho");
  expect(fontRequest.calls).toBe(1);
});

test("disposes loaded fonts when the provider unmounts", async ({ fontRequest }) => {
  const before = document.fonts.size;
  let loaded: ReadyTypography | undefined;
  const screen = await render(
    <TypographyProvider>
      <Slot
        fontPreset="mincho"
        label="first"
        onReady={(typography) => {
          loaded = typography;
        }}
      />
    </TypographyProvider>,
  );
  await expect.element(screen.getByTestId("first"), { timeout: 10000 }).toBeVisible();
  await expect.poll(() => loaded).toBeDefined();
  expect.assert(loaded !== undefined);
  const typography = loaded;
  expect(document.fonts.size).toBeGreaterThan(before);
  await expect(fetch(typography.fontFaces[0]?.src ?? "")).resolves.toBeInstanceOf(Response);

  await screen.unmount();

  await expect.poll(() => document.fonts.size).toBe(before);
  const [face] = typography.fontFaces;
  expect.assert(face !== undefined);
  await expect(fetch(face.src)).rejects.toBeInstanceOf(TypeError);
  expect(fontRequest.calls).toBe(1);
});

test("disposes a font that finishes loading after the provider unmounts", async ({
  fontRequest,
}) => {
  hold(fontRequest);
  const before = document.fonts.size;
  const screen = await render(
    <TypographyProvider>
      <Slot fontPreset="mincho" label="first" />
    </TypographyProvider>,
  );
  await expect.element(screen.getByRole("status")).toBeVisible();

  await screen.unmount();
  fontRequest.release();

  await expect
    .poll(() => fontRequest.adds > 0 && document.fonts.size === before, { timeout: 10000 })
    .toBe(true);
});

test("keeps typography usable when an Activity is hidden and its content changes", async () => {
  function Measured({ text }: Readonly<{ text: string }>) {
    const state = useTypography("mincho");
    if (state.kind === "failed") return <p role="alert">failed</p>;
    try {
      state.typography.measurer({
        text,
        kind: "base",
        presentation: "mixed",
        fontPreset: "mincho",
        fontSizeQ: 12.7,
        scale: 1,
        writingMode: "vertical-rl",
      });
    } catch {
      return <p role="alert">measurement failed</p>;
    }
    return <p>{text}</p>;
  }
  const view = (mode: "visible" | "hidden", text: string) => (
    <Activity mode={mode}>
      <TypographyProvider>
        <Suspense fallback={<p role="status">loading</p>}>
          <Measured text={text} />
        </Suspense>
      </TypographyProvider>
    </Activity>
  );
  const screen = await render(view("visible", "本文"));
  await expect.element(screen.getByText("本文"), { timeout: 10000 }).toBeVisible();

  await screen.rerender(view("hidden", "本文"));
  await screen.rerender(view("hidden", "編集後"));
  await screen.rerender(view("visible", "編集後"));

  await expect.element(screen.getByText("編集後"), { timeout: 10000 }).toBeVisible();
  expect(screen.getByRole("alert").query()).toBeNull();
});

test("does not load fonts for an uncommitted provider", async ({ fontRequest }) => {
  const screen = await render(
    <Activity mode="hidden">
      <span data-testid="hidden-rendered" />
      <TypographyProvider>
        <Slot fontPreset="mincho" label="first" />
      </TypographyProvider>
    </Activity>,
  );

  await expect
    .poll(() => screen.container.querySelector('[data-testid="hidden-rendered"]'))
    .not.toBeNull();
  await screen.unmount();

  expect(fontRequest.calls).toBe(0);
  expect(fontRequest.adds).toBe(0);
});

test("starts loading when a previously uncommitted provider becomes active", async ({
  fontRequest,
}) => {
  const view = (mode: "visible" | "hidden") => (
    <Activity mode={mode}>
      <span data-testid="hidden-rendered" />
      <TypographyProvider>
        <Slot fontPreset="mincho" label="first" />
      </TypographyProvider>
    </Activity>
  );
  const screen = await render(view("hidden"));
  await expect
    .poll(() => screen.container.querySelector('[data-testid="hidden-rendered"]'))
    .not.toBeNull();
  expect(fontRequest.calls).toBe(0);

  await screen.rerender(view("visible"));

  await expect.element(screen.getByTestId("first"), { timeout: 10000 }).toBeVisible();
  expect(fontRequest.calls).toBe(1);
});
