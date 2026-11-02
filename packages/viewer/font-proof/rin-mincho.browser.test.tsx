import {
  composeManuscript,
  NovelCompositionSettings,
  parseManuscript,
  pixivParser,
} from "@sushichan044/kg-core";
import { expect } from "vite-plus/test";
import { page, server } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { NovelViewer } from "../src/NovelViewer";
import { loadTypography } from "../src/typography";
import { test } from "./fixture";

test("matches both Rin faces to independent HarfBuzz metrics and draws combined kana and ruby", async ({
  fonts,
}) => {
  const before = document.fonts.size;
  const loaded = await loadTypography({ fontPreset: "mincho" });
  expect.assert(loaded.ok);
  try {
    expect(document.fonts.size).toBe(before + 2);
    const parsed = parseManuscript("あ゛ん゛ぁ゛ア゜ㇷ゜[b:office][[rb:あ゛>ん゛]]", {
      parser: pixivParser,
    });
    expect.assert(parsed.ok);
    const prepared = loaded.value.prepare(parsed.value);
    const composed = composeManuscript(prepared.parsed, {
      composer: loaded.value.composer,
      settings: NovelCompositionSettings.defaults,
    });
    expect.assert(composed.ok);
    expect(composed.value.parsed.source).toBe(parsed.value.source);

    for (const weight of [400, 700] as const) {
      const key = JSON.stringify([
        weight === 400 ? "rin-regular" : "rin-bold",
        "ltr",
        true,
        true,
        "office",
      ]);
      const oracle = fonts.fixture.measurements[key];
      expect.assert(oracle !== undefined);
      const measured = loaded.value.measurer({
        text: "office",
        kind: "base",
        presentation: "sideways",
        fontPreset: "mincho",
        fontSizeQ: 12.7,
        scale: 1,
        writingMode: "vertical-rl",
        style: { weight, slant: "normal" },
      });
      expect(measured).toEqual(oracle.measurement);
    }
    const screen = await render(
      <NovelViewer composed={composed.value} typography={loaded.value} />,
    );
    expect(screen.container.querySelectorAll(".kgv-cell")).toHaveLength(7);
    const glyphs = [...screen.container.querySelectorAll<HTMLElement>(".kgv-glyph")];
    expect(glyphs.slice(0, 5).map((glyph) => glyph.textContent)).toEqual([
      "あ゙",
      "ん゙",
      "ぁ゙",
      "ア゚",
      "ㇷ゚",
    ]);
    for (const glyph of glyphs) {
      const cell = glyph.closest<HTMLElement>(".kgv-cell");
      expect.assert(cell !== null);
      const advance = Number(cell.style.getPropertyValue("--kgv-item-advance"));
      const px = Number.parseFloat(getComputedStyle(glyph).fontSize);
      expect(Math.abs(glyph.getBoundingClientRect().height - advance * px)).toBeLessThanOrEqual(
        0.25,
      );
    }
    const bold = screen.container.querySelector<HTMLElement>('[data-annotation="bold"]');
    const ruby = screen.container.querySelector<HTMLElement>(".kgv-ruby-character");
    expect.assert(bold !== null && ruby !== null);
    expect(getComputedStyle(bold).fontWeight).toBe("700");
    expect(ruby.textContent).toBe("ん゙");
    const base = glyphs.at(-1);
    expect.assert(base !== undefined);
    expect(ruby.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      base.getBoundingClientRect().right - 0.25,
    );
    const element = screen.container.querySelector<HTMLElement>(".kgv-page");
    expect.assert(element !== null);
    await page.screenshot({
      element,
      path: `${server.config.root}/font-proof/.cache/evidence/rin-mincho-${server.browser}.png`,
    });
  } finally {
    loaded.value.dispose();
  }
  expect(document.fonts.size).toBe(before);
});

test("rejects a failed Bold face without registering part of the profile", async () => {
  const before = document.fonts.size;
  const loaded = await loadTypography({
    fontPreset: "mincho",
    fontUrls: { 700: "data:application/octet-stream;base64,YWJj" },
  });
  expect(loaded).toEqual({ ok: false, error: { kind: "font-integrity" } });
  expect(document.fonts.size).toBe(before);
});
