import {
  composeManuscript,
  novelComposer,
  NovelCompositionSettings,
  parseManuscript,
} from "@sushichan044/kg-core";
import { createRef, StrictMode } from "react";
import { expect, test as base, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { NovelViewer } from "./NovelViewer";
import type { NovelViewHandle } from "./NovelViewer";

import "./styles.css";

type FontRequest = { failed: boolean; calls: number; gate: Promise<void> | undefined };
const test = base.extend<{ fontRequest: FontRequest }>({
  fontRequest: async ({}, use) => {
    const nativeFetch = globalThis.fetch;
    const request: FontRequest = { failed: false, calls: 0, gate: undefined };
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("GenEiKoburiMin6-R")) {
        request.calls += 1;
        await request.gate;
        if (request.failed) return new Response(null, { status: 503 });
      }
      return nativeFetch(input, init);
    });
    try {
      await use(request);
    } finally {
      vi.unstubAllGlobals();
    }
  },
});

function composed(text: string, fontPreset: "mincho" | "gothic" = "mincho", fontSizePt = 9) {
  const parsed = parseManuscript(text);
  expect.assert(parsed.ok);
  const result = composeManuscript(parsed.value, {
    composer: novelComposer,
    settings: {
      ...NovelCompositionSettings.defaults,
      appearance: { ...NovelCompositionSettings.defaults.appearance, fontPreset, fontSizePt },
    },
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
    .poll(() => screen.container.querySelector('[data-typography="genei-koburi"]') !== null)
    .toBe(true);
  const glyph = screen.container.querySelector<HTMLElement>(".kgv-glyph-sideways");
  expect.assert(glyph !== null);
  expect(glyph.textContent).toBe("office");
  const cell = glyph.closest<HTMLElement>(".kgv-cell");
  expect.assert(cell !== null);
  expect(Number(cell.style.getPropertyValue("--kgv-item-advance"))).toBe(2733 / 1024);
  expect.assert(ref.current !== null);
  expect(ref.current.getVisiblePage()).toBe(0);

  await screen.rerender(<NovelViewer ref={ref} composed={composed("あwater", "mincho", 12)} />);
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
    .poll(() => screen.container.querySelector('[data-typography="genei-koburi"]') !== null)
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
