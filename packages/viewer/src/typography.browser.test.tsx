import {
  composeManuscript,
  NovelCompositionSettings,
  parseManuscript,
  pixivParser,
} from "@sushichan044/kg-core";
import { expect, test as base } from "vite-plus/test";
import { render } from "vitest-browser-react";

import fontUrl from "../assets/GenEiKoburiMin6-R.ttf?url";
import { NovelViewer } from "./NovelViewer";
import { loadGenEiKoburiTypography } from "./typography";
import type { ReadyTypography } from "./typography";

import "./styles.css";

const test = base.extend<{ typography: ReadyTypography }>({
  typography: async ({}, use) => {
    const loaded = await loadGenEiKoburiTypography({ fontUrl });
    expect.assert(loaded.ok);
    try {
      await use(loaded.value);
    } finally {
      loaded.value.dispose();
    }
  },
});

test.for([9, 12])(
  "draws arbitrary Western runs with authoritative ligature positions at %spt",
  async (fontSizePt, { typography }) => {
    const parsed = parseManuscript("あofficeいwaterうUncataloguedword");
    expect.assert(parsed.ok);
    const composed = composeManuscript(parsed.value, {
      composer: typography.composer,
      settings: {
        ...NovelCompositionSettings.defaults,
        appearance: {
          ...NovelCompositionSettings.defaults.appearance,
          fontPreset: "mincho",
          fontSizePt,
        },
      },
    });
    expect.assert(composed.ok);

    const screen = await render(<NovelViewer composed={composed.value} typography={typography} />);

    const units = composed.value.layout.pages.flatMap(({ stages }) =>
      stages.flatMap(({ lines }) => lines.flatMap(({ items }) => items)),
    );
    const office = units.find((item) => item.kind === "combined-glyph" && item.value === "office");
    expect.assert(office?.kind === "combined-glyph");
    expect(office.renderSpan.advanceEm).toBe(2733 / 1024);
    expect(
      office.sources.some((source) => source.kind === "shared" && source.ranges.length === 3),
    ).toBe(true);
    for (const glyph of screen.container.querySelectorAll<HTMLElement>(".kgv-glyph")) {
      const cell = glyph.closest<HTMLElement>(".kgv-cell");
      const line = glyph.closest<HTMLElement>(".kgv-line");
      expect.assert(cell !== null && line !== null);
      const fontPx = Number.parseFloat(getComputedStyle(glyph).fontSize);
      const advance = Number(cell.style.getPropertyValue("--kgv-item-advance"));
      const offset = Number(cell.style.getPropertyValue("--kgv-item-offset"));
      expect(Math.abs(glyph.getBoundingClientRect().height - advance * fontPx)).toBeLessThanOrEqual(
        0.25,
      );
      expect(
        Math.abs(
          glyph.getBoundingClientRect().top - line.getBoundingClientRect().top - offset * fontPx,
        ),
      ).toBeLessThanOrEqual(0.25);
    }
  },
);

test("preserves upright abbreviations, tate-chu-yoko, combining marks and fallback text", async ({
  typography,
}) => {
  const parsed = parseManuscript("あQRい12うあ\u3099え🦄お𠮷");
  expect.assert(parsed.ok);
  const composed = composeManuscript(parsed.value, {
    composer: typography.composer,
    settings: NovelCompositionSettings.defaults,
  });
  expect.assert(composed.ok);

  const screen = await render(<NovelViewer composed={composed.value} typography={typography} />);

  const tcy = screen.container.querySelector<HTMLElement>(".kgv-glyph-tate-chu-yoko");
  expect.assert(tcy !== null);
  expect(tcy.textContent).toBe("12");
  expect(
    Math.abs(
      tcy.getBoundingClientRect().height - Number.parseFloat(getComputedStyle(tcy).fontSize),
    ),
  ).toBeLessThanOrEqual(0.25);
  expect(screen.container.querySelectorAll(".kgv-glyph-upright")).toHaveLength(2);
  expect(screen.container.textContent).toContain("🦄");
  expect(
    typography.measurer({
      text: "あ",
      kind: "base",
      presentation: "mixed",
      fontPreset: "mincho",
      fontSizePt: 9,
      scale: 1,
      writingMode: "vertical-rl",
    }).advanceEm,
  ).toBe(1);
  expect(
    typography.measurer({
      text: "あ",
      kind: "ruby",
      presentation: "mixed",
      fontPreset: "mincho",
      fontSizePt: 9,
      scale: 0.5,
      writingMode: "vertical-rl",
    }).advanceEm,
  ).toBe(0.5);
});

test("reshapes around partial bold and italic without crossing their boundaries", async ({
  typography,
}) => {
  const parsed = parseManuscript("あo[b:f]f[i:ice]い", { parser: pixivParser });
  expect.assert(parsed.ok);
  const composed = composeManuscript(parsed.value, {
    composer: typography.composer,
    settings: NovelCompositionSettings.defaults,
  });
  expect.assert(composed.ok);

  const screen = await render(<NovelViewer composed={composed.value} typography={typography} />);

  const bold = screen.container.querySelector<HTMLElement>('[data-annotation="bold"]');
  const italic = screen.container.querySelector<HTMLElement>('[data-annotation="italic"]');
  expect.assert(bold !== null && italic !== null);
  expect(bold.textContent).toBe("f");
  expect(italic.textContent).toBe("ice");
  const units = composed.value.layout.pages.flatMap(({ stages }) =>
    stages.flatMap(({ lines }) => lines.flatMap(({ items }) => items)),
  );
  expect(units.some((item) => item.kind === "combined-glyph" && item.value === "office")).toBe(
    false,
  );
});

test("refuses substituted font bytes before installing a face", async () => {
  const result = await loadGenEiKoburiTypography({
    fontUrl: "data:application/octet-stream;base64,YWJj",
  });

  expect(result).toEqual({ ok: false, error: { kind: "font-integrity" } });
});
