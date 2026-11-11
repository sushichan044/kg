import type { FontPresetId } from "@sushichan044/kg-core";
import { Suspense, useEffect } from "react";
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
  useEffect(() => {
    if (typography !== undefined) onReady?.(typography);
  }, [onReady, typography]);
  if (state.kind === "failed")
    return (
      <div role="alert">
        <p>{state.error.kind}</p>
        <button type="button" onClick={state.retry}>
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
