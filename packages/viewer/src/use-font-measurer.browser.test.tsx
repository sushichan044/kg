import type { FontPresetId } from "@sushichan044/kg-core";
import { Suspense, useTransition } from "react";
import { expect, test as base, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { resetFontMeasurers, useFontMeasurer } from "./use-font-measurer";

type FontRequest = {
  failed: boolean;
  calls: number;
  fonts: number;
  gate: Promise<void> | undefined;
  release: () => void;
};

const test = base.extend<{ fontRequest: FontRequest }>({
  fontRequest: async ({}, use) => {
    const nativeFetch = globalThis.fetch;
    const request: FontRequest = {
      failed: false,
      calls: 0,
      fonts: 0,
      gate: undefined,
      release: () => {},
    };
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith(".ttf")) request.fonts += 1;
      if (url.includes("RinMincho-Regular")) {
        request.calls += 1;
        await request.gate;
        if (request.failed) return new Response(null, { status: 503 });
      }
      return nativeFetch(input, init);
    });
    resetFontMeasurers();
    try {
      await use(request);
    } finally {
      request.release();
      vi.unstubAllGlobals();
      resetFontMeasurers();
    }
  },
});

function hold(request: FontRequest) {
  request.gate = new Promise<void>((resolve) => {
    request.release = resolve;
  });
}

function Probe({ fontPreset, label }: Readonly<{ fontPreset: FontPresetId; label: string }>) {
  const state = useFontMeasurer(fontPreset);
  // retry の中の startTransition はこの遷移にまとまるので、aria-busy が false に戻るのは再試行の結果が描画されたとき
  const [retrying, startRetry] = useTransition();
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
  return <p data-testid={label}>{state.measurer.fontPreset}</p>;
}

function Slot(props: Parameters<typeof Probe>[0]) {
  return (
    <Suspense fallback={<p role="status">loading</p>}>
      <Probe {...props} />
    </Suspense>
  );
}

test("suspends with the fallback until the measurer is ready", async ({ fontRequest }) => {
  hold(fontRequest);
  const screen = await render(<Slot fontPreset="mincho" label="first" />);

  await expect.element(screen.getByRole("status")).toHaveTextContent("loading");
  expect(screen.getByTestId("first").query()).toBeNull();

  fontRequest.release();

  await expect.element(screen.getByTestId("first"), { timeout: 10000 }).toHaveTextContent("mincho");
  expect(screen.getByRole("status").query()).toBeNull();
});

test("shows the failure and loads again on retry", async ({ fontRequest }) => {
  fontRequest.failed = true;
  const screen = await render(<Slot fontPreset="mincho" label="first" />);
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
    <>
      <div data-testid="first-slot">
        <Slot fontPreset="mincho" label="first" />
      </div>
      <div data-testid="second-slot">
        <Slot fontPreset="mincho" label="second" />
      </div>
    </>,
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

test("serves an already loaded preset without suspending again", async ({ fontRequest }) => {
  const screen = await render(<Slot fontPreset="mincho" label="first" />);
  await expect.element(screen.getByTestId("first"), { timeout: 10000 }).toBeVisible();

  await screen.rerender(
    <>
      <Slot fontPreset="mincho" label="first" />
      <Slot fontPreset="mincho" label="second" />
    </>,
  );

  expect(screen.getByRole("status").query()).toBeNull();
  expect(screen.getByTestId("second").query()?.textContent).toBe("mincho");
  expect(fontRequest.calls).toBe(1);
});

test("keeps a loaded preset across unmounting every consumer", async ({ fontRequest }) => {
  const first = await render(<Slot fontPreset="mincho" label="first" />);
  await expect.element(first.getByTestId("first"), { timeout: 10000 }).toBeVisible();
  await first.unmount();

  const second = await render(<Slot fontPreset="mincho" label="again" />);

  expect(second.getByRole("status").query()).toBeNull();
  expect(second.getByTestId("again").query()?.textContent).toBe("mincho");
  expect(fontRequest.calls).toBe(1);
});

test("resolves the logical preset without fetching or suspending", async ({ fontRequest }) => {
  const screen = await render(<Slot fontPreset="gothic" label="gothic" />);

  expect(screen.getByRole("status").query()).toBeNull();
  expect(screen.getByTestId("gothic").query()?.textContent).toBe("gothic");
  expect(fontRequest.fonts).toBe(0);
});
