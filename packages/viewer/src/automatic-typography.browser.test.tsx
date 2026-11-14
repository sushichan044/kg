import {
  composeManuscript,
  novelComposer,
  NovelCompositionSettings,
  parseManuscript,
} from "@sushichan044/kg-core";
import { Activity, createRef, StrictMode } from "react";
import { expect, test as base, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { NovelViewer } from "./NovelViewer";
import type { NovelViewHandle } from "./NovelViewer";
import { TypographyProvider } from "./TypographyProvider";

import "./styles.css";

type FontRequest = {
  failed: boolean;
  setupFailed: boolean;
  calls: number;
  gate: Promise<void> | undefined;
};
const test = base.extend<{ fontRequest: FontRequest }>({
  fontRequest: async ({}, use) => {
    const nativeFetch = globalThis.fetch;
    const request: FontRequest = { failed: false, setupFailed: false, calls: 0, gate: undefined };
    const nativeAdd = document.fonts.add.bind(document.fonts);
    const add = vi.spyOn(document.fonts, "add").mockImplementation((face) => {
      if (request.setupFailed) throw new Error("Font registration failed");
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
      add.mockRestore();
      vi.unstubAllGlobals();
    }
  },
});

function composed(text: string, fontPreset: "mincho" | "gothic" = "mincho", fontSizeQ = 12.7) {
  const parsed = parseManuscript(text);
  expect.assert(parsed.ok);
  const result = composeManuscript(parsed.value, {
    composer: novelComposer,
    settings: NovelCompositionSettings.forPaper("a4", {
      ...NovelCompositionSettings.defaults,
      appearance: { ...NovelCompositionSettings.defaults.appearance, fontPreset, fontSizeQ },
    }),
  });
  expect.assert(result.ok);
  return result.value;
}

test("loads bundled Mincho and recomposes changed props without caller typography", async ({
  fontRequest,
}) => {
  let release = () => {};
  fontRequest.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ref = createRef<NovelViewHandle>();
  const before = document.fonts.size;
  const screen = await render(
    <StrictMode>
      <NovelViewer ref={ref} composed={composed("あoffice")} />
    </StrictMode>,
  );

  await expect.element(screen.getByRole("status")).toHaveTextContent("書体を読み込んでいます…");
  expect(screen.container.querySelector(".kgv-page")).toBeNull();
  release();
  await expect
    .poll(() => screen.container.querySelector('[data-typography="mincho"]') !== null, {
      timeout: 10000,
    })
    .toBe(true);
  const glyph = screen.container.querySelector<HTMLElement>(".kgv-glyph-sideways");
  expect.assert(glyph !== null);
  expect(glyph.textContent).toBe("office");
  const cell = glyph.closest<HTMLElement>(".kgv-cell");
  expect.assert(cell !== null);
  expect(Number(cell.style.getPropertyValue("--kgv-item-advance"))).toBe(2482 / 1024);
  expect.assert(ref.current !== null);
  expect(ref.current.getVisiblePage()).toBe(0);

  await screen.rerender(
    <NovelViewer ref={ref} composed={composed("あwater", "mincho", (12 * 25.4) / 18)} />,
  );
  await expect
    .poll(() => screen.container.querySelector(".kgv-glyph-sideways")?.textContent)
    .toBe("water");
  const changed = screen.container.querySelector<HTMLElement>(".kgv-glyph-sideways");
  expect.assert(changed !== null);
  expect(Number.parseFloat(getComputedStyle(changed).fontSize)).toBeCloseTo(16, 1);
  await screen.unmount();
  await expect.poll(() => document.fonts.size).toBe(before);
});

test("retries a failed bundled font load without displaying mismatched text", async ({
  fontRequest,
}) => {
  fontRequest.failed = true;
  const screen = await render(<NovelViewer composed={composed("office")} />);

  await expect.element(screen.getByRole("alert")).toBeVisible();
  expect(screen.container.querySelector(".kgv-page")).toBeNull();
  fontRequest.failed = false;
  await screen.getByRole("button", { name: "再試行" }).click();
  await expect
    .poll(() => screen.container.querySelector('[data-typography="mincho"]') !== null, {
      timeout: 10000,
    })
    .toBe(true);
  expect(fontRequest.calls).toBe(2);
});

test("preserves Gothic composition without loading Mincho", async ({ fontRequest }) => {
  const screen = await render(<NovelViewer composed={composed("office", "gothic")} />);

  await expect.element(screen.getByLabelText("小説プレビュー")).toBeVisible();
  expect(fontRequest.calls).toBe(0);
  expect(screen.container.querySelector("[data-typography]")).toBeNull();
  expect(screen.container.querySelectorAll(".kgv-cell")).toHaveLength(6);
});

test("offers retry when font setup rejects and recovers after retry", async ({ fontRequest }) => {
  fontRequest.setupFailed = true;
  const before = document.fonts.size;
  const screen = await render(<NovelViewer composed={composed("office")} />);

  await expect.element(screen.getByRole("alert")).toBeVisible();
  expect(screen.container.querySelector(".kgv-page")).toBeNull();
  expect(document.fonts.size).toBe(before);

  fontRequest.setupFailed = false;
  await screen.getByRole("button", { name: "再試行" }).click();

  await expect.element(screen.getByLabelText("小説プレビュー")).toBeVisible();
  expect(fontRequest.calls).toBe(2);
  await screen.unmount();
  expect(document.fonts.size).toBe(before);
});

test("shares fonts loaded by an enclosing TypographyProvider", async ({ fontRequest }) => {
  const screen = await render(
    <TypographyProvider>
      <NovelViewer composed={composed("office")} ariaLabel="1つ目" />
      <NovelViewer composed={composed("water")} ariaLabel="2つ目" />
    </TypographyProvider>,
  );

  await expect.element(screen.getByLabelText("1つ目"), { timeout: 10000 }).toBeVisible();
  await expect.element(screen.getByLabelText("2つ目")).toBeVisible();

  expect(fontRequest.calls).toBe(1);
});

test("recomposes after its automatic typography is released and the view is restored", async () => {
  const view = (mode: "visible" | "hidden", text: string) => (
    <Activity mode={mode}>
      <NovelViewer composed={composed(text)} />
    </Activity>
  );
  const screen = await render(view("visible", "本文"));
  await expect
    .poll(() => screen.container.querySelector(".kgv-line-text")?.textContent, { timeout: 10000 })
    .toContain("本文");

  await screen.rerender(view("hidden", "本文"));
  await screen.rerender(view("hidden", "編集後"));
  await screen.rerender(view("visible", "編集後"));

  await expect
    .poll(() => screen.container.querySelector(".kgv-line-text")?.textContent, { timeout: 10000 })
    .toContain("編集後");
  expect(screen.getByRole("alert").query()).toBeNull();
});
