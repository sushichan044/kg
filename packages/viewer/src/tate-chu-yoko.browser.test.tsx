import {
  composeManuscript,
  NovelCompositionSettings,
  parseManuscript,
  pixivParser,
} from "@sushichan044/kg-core";
import type { FontPresetId } from "@sushichan044/kg-core";
import { expect, test as base } from "vite-plus/test";
import { render } from "vitest-browser-react";

import geneiUrl from "../assets/GenEiKoburiMin6-R.ttf?url";
import rinBoldUrl from "../assets/RinMincho-Bold.ttf?url";
import rinUrl from "../assets/RinMincho-Regular.ttf?url";
import { NovelViewer } from "./NovelViewer";
import { loadTypography } from "./typography";
import type { ReadyTypography } from "./typography";

import "./styles.css";

const FONT_URLS = {
  mincho: { 400: rinUrl, 700: rinBoldUrl },
  "genei-koburi": { 400: geneiUrl },
  gothic: undefined,
} as const satisfies Record<FontPresetId, unknown>;

const test = base.extend<{ typographyFor: (preset: FontPresetId) => Promise<ReadyTypography> }>({
  typographyFor: async ({}, use) => {
    const loaded: ReadyTypography[] = [];
    try {
      await use(async (fontPreset) => {
        const result = await loadTypography({ fontPreset, fontUrls: FONT_URLS[fontPreset] });
        expect.assert(result.ok);
        loaded.push(result.value);
        return result.value;
      });
    } finally {
      for (const typography of loaded) typography.dispose();
    }
  },
});

// 倫明朝の「！？！」は、WebKit の text-combine-upright が 1em に収められず、組まずに縦に並べていた
const TATE_CHU_YOKO = ["12", "60", "!?", "！？", "！？！", "!!", "[b:34]"];

function compose(source: string, typography: ReadyTypography) {
  const parsed = parseManuscript(source, { parser: pixivParser });
  expect.assert(parsed.ok);
  const composed = composeManuscript(typography.prepare(parsed.value).parsed, {
    composer: typography.composer,
    settings: NovelCompositionSettings.forPaper("a4", {
      ...NovelCompositionSettings.defaults,
      appearance: {
        ...NovelCompositionSettings.defaults.appearance,
        fontPreset: typography.fontPreset,
      },
      flow: { lineLengthEm: 40, linesPerStage: 10, stagesPerPage: 1 },
    }),
  });
  expect.assert(composed.ok);
  return composed.value;
}

function characterBox(text: Text, index: number): DOMRect {
  const range = document.createRange();
  range.setStart(text, index);
  range.setEnd(text, index + 1);
  return range.getBoundingClientRect();
}

function textNodes(element: Element): Text[] {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode() !== null) nodes.push(walker.currentNode as Text);
  return nodes;
}

function measureGlyph(glyph: HTMLElement) {
  const cell = glyph.closest<HTMLElement>(".kgv-cell");
  expect.assert(cell !== null);
  const nodes = textNodes(glyph);
  const first = nodes[0];
  const last = nodes.at(-1);
  expect.assert(first !== undefined && last !== undefined);
  return {
    value: glyph.textContent,
    cell: cell.getBoundingClientRect(),
    glyph: glyph.getBoundingClientRect(),
    naturalWidthEm: glyph.offsetWidth / Number.parseFloat(getComputedStyle(glyph).fontSize),
    head: characterBox(first, 0),
    tail: characterBox(last, last.length - 1),
  };
}

const PRESETS: readonly FontPresetId[] = ["mincho", "genei-koburi", "gothic"];

test.for(PRESETS)("draws upright tate-chu-yoko (%s)", async (preset, { typographyFor }) => {
  const typography = await typographyFor(preset);
  const composed = compose(`あ${TATE_CHU_YOKO.join("あ")}あ`, typography);
  const units = composed.layout.pages
    .flatMap(({ stages }) => stages.flatMap(({ lines }) => lines.flatMap(({ items }) => items)))
    .flatMap((item) =>
      item.kind === "combined-glyph" && item.presentation === "tate-chu-yoko" ? [item] : [],
    );

  const screen = await render(<NovelViewer composed={composed} typography={typography} />);

  const drawn = Array.from(
    screen.container.querySelectorAll<HTMLElement>(".kgv-glyph-tate-chu-yoko"),
    measureGlyph,
  );
  expect(drawn.map(({ value }) => value)).toEqual(["12", "60", "!?", "！？", "！？！", "!!", "34"]);
  expect(units.map(({ value }) => value)).toEqual(drawn.map(({ value }) => value));
  // 縮める比率はコンポーザーの幅から決めるので、縮める前の字幅がその幅と違うと、こまに収まらないか余る
  expect(
    drawn
      .filter(
        ({ naturalWidthEm }, index) =>
          Math.abs(naturalWidthEm - (units[index]?.horizontalAdvanceEm ?? 0)) > 0.05,
      )
      .map(({ value }) => value),
  ).toEqual([]);
  expect(
    drawn
      .filter(
        ({ cell, glyph }) =>
          glyph.width > cell.width + 0.5 ||
          Math.abs(glyph.height - cell.height) > 0.5 ||
          Math.abs(glyph.left + glyph.width / 2 - cell.left - cell.width / 2) > 0.5,
      )
      .map(({ value }) => value),
  ).toEqual([]);
  // 横倒しや、組まずに縦に並べた字は、先頭と末尾の字が上下に並ぶ
  expect(
    drawn
      .filter(({ head, tail }) => tail.left <= head.left || Math.abs(tail.top - head.top) > 0.5)
      .map(({ value }) => value),
  ).toEqual([]);
});
