import {
  composeManuscript,
  kakuyomuParser,
  novelComposer,
  NovelCompositionSettings,
  parseManuscript,
} from "@sushichan044/kg-core";
import { expect, test as base } from "vite-plus/test";
import { server } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { NovelViewer } from "./NovelViewer";
import { loadTypography } from "./typography";
import type { ReadyTypography } from "./typography";

import "./styles.css";

const TOLERANCE_PX = 0.25;

// 測定の経路をすべて通るよう、mixed、upright、sideways、縦中横、vmtx が 1 em でない文字を混ぜる
const CORPUS = [
  "あア漢字〆々ゃっヴヶーゝ",
  "「」『』（）、。・：；〔〕【】〜…‥―",
  "！？‼⁉Ａｚ０＃＠㍿①™♡♪☆",
  "“”‘’ｱｶﾞﾊﾟｰ｡｢｣､･",
  "あ%い@う'え(お#か$き&く*け+こ=さ_し~す|せ/そ<た>",
  "éñΩЖ€",
  "あ゙ん゙ア゚",
  "AとQRと12とofficeとwater",
].join("");

type Underdrawn = Readonly<{ base: readonly string[]; ruby: readonly string[] }>;

const NOT_UNDERDRAWN: Underdrawn = { base: [], ruby: [] };

// Linux の WebKit は vmtx を読まず、正立の字形を横の送り幅の高さで描く
// 測定はフォントの値のままなので、枠より小さく描かれる文字をここに固定し、増減したら気づけるようにする
const UNDERDRAWN: Record<"mincho" | "genei-koburi", Underdrawn> =
  server.browser === "webkit" && server.platform === "linux"
    ? {
        mincho: { base: ["™", "“", "”", "‘", "’", "A", "Q", "R", "〱", "〲"], ruby: ["A", "“"] },
        "genei-koburi": { base: ["ア゚"], ruby: [] },
      }
    : { mincho: NOT_UNDERDRAWN, "genei-koburi": NOT_UNDERDRAWN };

const test = base.extend<{ typographies: Record<"mincho" | "genei-koburi", ReadyTypography> }>({
  typographies: async ({}, use) => {
    const [mincho, genei] = await Promise.all([
      loadTypography({ fontPreset: "mincho" }),
      loadTypography({ fontPreset: "genei-koburi" }),
    ]);
    expect.assert(mincho.ok && genei.ok);
    try {
      await use({ mincho: mincho.value, "genei-koburi": genei.value });
    } finally {
      mincho.value.dispose();
      genei.value.dispose();
    }
  },
});

function compose(typography: ReadyTypography, source: string) {
  const parsed = parseManuscript(source, { parser: kakuyomuParser });
  expect.assert(parsed.ok);
  const prepared = typography.prepare(parsed.value);
  const composed = composeManuscript(prepared.parsed, {
    composer: typography.composer,
    settings: NovelCompositionSettings.forPaper("a4", {
      ...NovelCompositionSettings.defaults,
      appearance: {
        ...NovelCompositionSettings.defaults.appearance,
        fontPreset: typography.fontPreset,
      },
    }),
  });
  expect.assert(composed.ok);
  return composed.value;
}

function cellMismatches(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(".kgv-cell")].flatMap((cell) => {
    const glyph = cell.querySelector<HTMLElement>(".kgv-glyph");
    expect.assert(glyph !== null);
    const fontPx = Number.parseFloat(getComputedStyle(glyph).fontSize);
    const measuredPx = Number(cell.style.getPropertyValue("--kgv-item-advance")) * fontPx;
    const drawnPx = glyph.getBoundingClientRect().height;
    return Math.abs(drawnPx - measuredPx) <= TOLERANCE_PX
      ? []
      : [
          {
            text: glyph.textContent,
            orientation: getComputedStyle(glyph).textOrientation,
            drawnPx,
            measuredPx,
          },
        ];
  });
}

test.for(["mincho", "genei-koburi"] as const)(
  "draws every base glyph at its measured advance with %s",
  async (fontPreset, { typographies }) => {
    const typography = typographies[fontPreset];
    // 〱〲 は Rin にだけあり、vmtx が 2 em になっている
    const composed = compose(typography, fontPreset === "mincho" ? `${CORPUS}〱〲` : CORPUS);

    const screen = await render(<NovelViewer composed={composed} typography={typography} />);

    expect(screen.container.querySelectorAll(".kgv-cell").length).toBeGreaterThan(80);
    const mismatches = cellMismatches(screen.container);
    const underdrawn = UNDERDRAWN[fontPreset].base;
    expect(mismatches.filter(({ text }) => !underdrawn.includes(text))).toEqual([]);
    expect(mismatches.map(({ text }) => text)).toEqual(underdrawn);
  },
);

test.for(["mincho", "genei-koburi"] as const)(
  "never leaves measured text to text-orientation mixed with %s",
  async (fontPreset, { typographies }) => {
    const typography = typographies[fontPreset];
    const composed = compose(typography, CORPUS);

    const screen = await render(<NovelViewer composed={composed} typography={typography} />);

    const mixed = [...screen.container.querySelectorAll<HTMLElement>(".kgv-glyph")].filter(
      (glyph) =>
        !glyph.classList.contains("kgv-glyph-tate-chu-yoko") &&
        getComputedStyle(glyph).textOrientation === "mixed",
    );
    expect(mixed.map((glyph) => glyph.textContent)).toEqual([]);
  },
);

test.for(["mincho", "genei-koburi"] as const)(
  "pins quotes and Western symbols in Japanese text to the measured orientation with %s",
  async (fontPreset, { typographies }) => {
    const typography = typographies[fontPreset];
    const composed = compose(typography, "あ“い”う%え｢お");

    const screen = await render(<NovelViewer composed={composed} typography={typography} />);

    const orientations = Object.fromEntries(
      [...screen.container.querySelectorAll<HTMLElement>(".kgv-glyph")].map((glyph) => [
        glyph.textContent,
        [glyph.dataset["orientation"], glyph.lang],
      ]),
    );
    expect(orientations).toMatchObject({
      "“": ["upright", "ja"],
      "”": ["upright", "ja"],
      "%": ["sideways", "en"],
      "｢": ["sideways", "en"],
      あ: ["upright", "ja"],
    });
  },
);

test.for(["mincho", "genei-koburi"] as const)(
  "draws ruby at the advance the measurer gives with %s",
  async (fontPreset, { typographies }) => {
    const typography = typographies[fontPreset];
    const reading = "かんA%“ー〜";
    const composed = compose(typography, `｜漢字《${reading}》`);

    const screen = await render(<NovelViewer composed={composed} typography={typography} />);

    const characters = [...screen.container.querySelectorAll<HTMLElement>(".kgv-ruby-character")];
    expect(characters.map((character) => character.textContent).join("")).toBe(reading);
    const mismatches = characters.flatMap((character) => {
      const range = document.createRange();
      range.selectNodeContents(character);
      const fontPx = Number.parseFloat(getComputedStyle(character).fontSize);
      const measured = typography.measurer({
        text: character.textContent,
        kind: "ruby",
        presentation: "mixed",
        fontPreset,
        fontSizeQ: composed.settings.appearance.fontSizeQ,
        scale: 1,
        writingMode: "vertical-rl",
      }).advanceEm;
      const drawnPx = range.getBoundingClientRect().height;
      return Math.abs(drawnPx - measured * fontPx) <= TOLERANCE_PX
        ? []
        : [{ text: character.textContent, drawnPx, measuredPx: measured * fontPx }];
    });
    const underdrawn = UNDERDRAWN[fontPreset].ruby;
    expect(mismatches.filter(({ text }) => !underdrawn.includes(text))).toEqual([]);
    expect(mismatches.map(({ text }) => text)).toEqual(underdrawn);
  },
);

test.for([
  ["mincho", "あ한い😀うșえกお"],
  ["genei-koburi", "あ😀いșうกえ〱"],
] as const)(
  "places glyphs missing from %s exactly where the logical measurer would",
  async ([fontPreset, text], { typographies }) => {
    const typography = typographies[fontPreset];
    const composed = compose(typography, text);
    const logical = composeManuscript(composed.parsed, {
      composer: novelComposer,
      settings: composed.settings,
    });
    expect.assert(logical.ok);

    const screen = await render(<NovelViewer composed={composed} typography={typography} />);

    const cells = [...screen.container.querySelectorAll<HTMLElement>(".kgv-cell")].map((cell) => [
      cell.textContent,
      Number(cell.style.getPropertyValue("--kgv-item-offset")),
      Number(cell.style.getPropertyValue("--kgv-item-advance")),
    ]);
    const expected = logical.value.layout.pages.flatMap(({ stages }) =>
      stages.flatMap(({ lines }) =>
        lines.flatMap(({ items }) =>
          items.flatMap((item) =>
            item.kind === "glyph"
              ? [[item.value, item.renderSpan.offsetEm, item.renderSpan.advanceEm]]
              : [],
          ),
        ),
      ),
    );
    expect(cells).toEqual(expected);
  },
);
