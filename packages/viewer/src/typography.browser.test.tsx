import {
  composeManuscript,
  NovelCompositionSettings,
  parseManuscript,
  pixivParser,
  novelComposer,
} from "@sushichan044/kg-core";
import { expect, test as base } from "vite-plus/test";
import { render } from "vitest-browser-react";

import fontUrl from "../assets/GenEiKoburiMin6-R.ttf?url";
import { NovelViewer } from "./NovelViewer";
import { loadTypography } from "./typography";
import type { ReadyTypography } from "./typography";
import { splitUprightHalfwidth } from "./upright-halfwidth";

import "./styles.css";

const test = base.extend<{ typography: ReadyTypography }>({
  typography: async ({}, use) => {
    const loaded = await loadTypography({ fontPreset: "genei-koburi", fontUrls: { 400: fontUrl } });
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
      settings: NovelCompositionSettings.forPaper("a4", {
        ...NovelCompositionSettings.defaults,
        appearance: {
          ...NovelCompositionSettings.defaults.appearance,
          fontPreset: "genei-koburi",
          fontSizeQ: (fontSizePt * 25.4) / 18,
          paperSize: "a4",
        },
      }),
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
    settings: {
      ...NovelCompositionSettings.defaults,
      appearance: { ...NovelCompositionSettings.defaults.appearance, fontPreset: "genei-koburi" },
    },
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
  // mixed のこまも計測と同じ向きに固定する。QR は upright、あ゙ を含む和字と絵文字は mixed の既定で正立
  expect(screen.container.querySelectorAll(".kgv-glyph-upright")).toHaveLength(10);
  expect(screen.container.querySelectorAll(".kgv-glyph-sideways")).toHaveLength(0);
  expect(screen.container.textContent).toContain("🦄");
  expect(
    typography.measurer({
      text: "あ",
      kind: "base",
      presentation: "mixed",
      fontPreset: "genei-koburi",
      fontSizeQ: 12.7,
      scale: 1,
      writingMode: "vertical-rl",
    }).advanceEm,
  ).toBeCloseTo(1, 10);
  expect(
    typography.measurer({
      text: "あ",
      kind: "ruby",
      presentation: "mixed",
      fontPreset: "genei-koburi",
      fontSizeQ: 12.7,
      scale: 0.5,
      writingMode: "vertical-rl",
    }).advanceEm,
  ).toBeCloseTo(0.5, 10);
});

// ルビは選択範囲に入らないよう生成コンテンツで描く
function drawnText(element: Element): string {
  return [element, ...element.querySelectorAll("*")]
    .map((node) => {
      const content = getComputedStyle(node, "::before").content;
      return content === "none" || content === "normal" ? "" : (JSON.parse(content) as string);
    })
    .join("");
}

// WebKit は源暎こぶり明朝の半角形を、正立を指定しても vrt2 の横倒しの字形で 0.5 em に描く
test("draws upright half-width forms in ruby at their composed advances", async ({
  typography,
}) => {
  const parsed = parseManuscript("[[rb:漢字>ｶﾝｼﾞ]]と[[rb:記号>｢ｰ｣]]", { parser: pixivParser });
  expect.assert(parsed.ok);
  const composed = composeManuscript(parsed.value, {
    composer: typography.composer,
    settings: {
      ...NovelCompositionSettings.defaults,
      appearance: { ...NovelCompositionSettings.defaults.appearance, fontPreset: "genei-koburi" },
    },
  });
  expect.assert(composed.ok);

  const screen = await render(<NovelViewer composed={composed.value} typography={typography} />);

  const characters = [...screen.container.querySelectorAll<HTMLElement>(".kgv-ruby-character")];
  expect(characters.map(drawnText).join("")).toBe("ｶﾝｼﾞ｢ｰ｣");
  expect(characters.map(({ textContent }) => textContent).join("")).toBe("");
  // 濁点は直前の字と同じ升に入るので、ｶﾝｼﾞ は 3 つ、｢ｰ｣ は 3 つの升になる
  expect(screen.container.querySelectorAll(".kgv-upright-halfwidth")).toHaveLength(6);
  for (const character of characters) {
    const box = character.getBoundingClientRect();
    const parts = [...character.querySelectorAll(".kgv-upright-part")].map((part) =>
      part.getBoundingClientRect(),
    );
    const drawnTop = Math.min(...parts.map(({ top }) => top));
    const drawnBottom = Math.max(...parts.map(({ bottom }) => bottom));
    expect(Math.abs(drawnBottom - drawnTop - box.height)).toBeLessThanOrEqual(0.25);
    expect(Math.abs(drawnTop - box.top)).toBeLessThanOrEqual(0.25);
  }
});

test.for(["ｼﾞ", "ﾊﾟ"])(
  "draws the mark of %s inside the one em cell of its base",
  async (text, { typography }) => {
    const wrapper = document.createElement("div");
    wrapper.className = "kgv-glyph kgv-glyph-upright";
    wrapper.lang = "ja";
    Object.assign(wrapper.style, {
      writingMode: "vertical-rl",
      fontFamily: typography.fontFamily,
      fontSize: "40px",
    });
    document.body.append(wrapper);
    try {
      for (const part of splitUprightHalfwidth(`漢${text}字`)) {
        const node = document.createElement("span");
        node.className = part.combined ? "kgv-upright-halfwidth" : "";
        node.textContent = part.text;
        wrapper.append(node);
      }
      await document.fonts.ready;

      const cells = wrapper.querySelectorAll<HTMLElement>(".kgv-upright-halfwidth");
      expect(cells).toHaveLength(1);
      const [cell] = cells;
      expect.assert(cell);
      const range = document.createRange();
      range.selectNodeContents(cell);
      const cellBox = cell.getBoundingClientRect();
      const drawn = range.getBoundingClientRect();
      // 基底と濁点・半濁点が、全角 1 字分の升の中に横に並んで描かれる
      expect(Math.abs(cellBox.width - 40)).toBeLessThanOrEqual(0.25);
      expect(Math.abs(cellBox.height - 40)).toBeLessThanOrEqual(0.25);
      expect(drawn.left).toBeGreaterThanOrEqual(cellBox.left - 0.25);
      expect(drawn.right).toBeLessThanOrEqual(cellBox.right + 0.25);
      expect(drawn.top).toBeGreaterThanOrEqual(cellBox.top - 0.25);
      expect(drawn.bottom).toBeLessThanOrEqual(cellBox.bottom + 0.25);
      expect(drawn.width).toBeGreaterThan(40 * 0.75);
    } finally {
      wrapper.remove();
    }
  },
);

test("measures a three-mark tate-chu-yoko run as the one em it is drawn in", ({ typography }) => {
  const request = {
    text: "！？！",
    kind: "base",
    presentation: "tate-chu-yoko",
    fontPreset: "genei-koburi",
    fontSizeQ: 12.7,
    scale: 1,
    writingMode: "vertical-rl",
  } as const;

  const measurement = typography.measurer(request);

  expect(measurement.advanceEm).toBe(1);
});

test("reshapes around partial bold and italic without crossing their boundaries", async ({
  typography,
}) => {
  const parsed = parseManuscript("あo[b:f]f[i:ice]い", { parser: pixivParser });
  expect.assert(parsed.ok);
  const composed = composeManuscript(parsed.value, {
    composer: typography.composer,
    settings: {
      ...NovelCompositionSettings.defaults,
      appearance: { ...NovelCompositionSettings.defaults.appearance, fontPreset: "genei-koburi" },
    },
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
  const result = await loadTypography({
    fontPreset: "genei-koburi",
    fontUrls: { 400: "data:application/octet-stream;base64,YWJj" },
  });

  expect(result).toEqual({ ok: false, error: { kind: "font-integrity" } });
});

test("rejects a resource for another font and prevents measurement after disposal", async () => {
  const loaded = await loadTypography({ fontPreset: "genei-koburi" });
  expect.assert(loaded.ok);
  const parsed = parseManuscript("あ");
  expect.assert(parsed.ok);
  const composed = composeManuscript(parsed.value, {
    composer: novelComposer,
    settings: NovelCompositionSettings.defaults,
  });
  expect.assert(composed.ok);

  const screen = await render(<NovelViewer composed={composed.value} typography={loaded.value} />);

  await expect
    .element(screen.getByRole("alert"))
    .toHaveTextContent("書体と組版設定が一致しません。");
  expect(screen.container.querySelector(".kgv-page")).toBeNull();
  const request = {
    text: "あ",
    kind: "base",
    presentation: "mixed",
    fontPreset: "mincho",
    fontSizeQ: 12.7,
    scale: 1,
    writingMode: "vertical-rl",
  } as const;
  expect(() => loaded.value.measurer(request)).toThrow("Typography font does not match");
  loaded.value.dispose();
  expect(() => loaded.value.measurer({ ...request, fontPreset: "genei-koburi" })).toThrow(
    "disposed",
  );
});
