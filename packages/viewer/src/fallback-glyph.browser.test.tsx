import {
  composeManuscript,
  NovelCompositionSettings,
  parseManuscript,
  pixivParser,
} from "@sushichan044/kg-core";
import { expect, test as base } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import fontUrl from "../assets/RinMincho-Regular.ttf?url";
import { NovelViewer } from "./NovelViewer";
import { loadTypography } from "./typography";
import type { ReadyTypography } from "./typography";

import "./styles.css";

const test = base.extend<{ typography: ReadyTypography }>({
  typography: async ({}, use) => {
    const loaded = await loadTypography({ fontPreset: "mincho", fontUrls: { 400: fontUrl } });
    expect.assert(loaded.ok);
    try {
      await use(loaded.value);
    } finally {
      loaded.value.dispose();
    }
  },
});

// 要素のスクリーンショットから、字面の左右の中心がボックスの中心からどれだけずれているかを、ボックスの幅に対する比で返す
async function inkOffset(element: HTMLElement): Promise<number> {
  const base64 = await page.elementLocator(element).screenshot({ save: false });
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("2d context is unavailable");
  context.drawImage(bitmap, 0, 0);
  const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  for (let y = 0; y < bitmap.height; y += 1) {
    for (let x = 0; x < bitmap.width; x += 1) {
      const at = (y * bitmap.width + x) * 4;
      const luminance = ((data[at] ?? 255) + (data[at + 1] ?? 255) + (data[at + 2] ?? 255)) / 3;
      if (luminance < 128) {
        left = Math.min(left, x);
        right = Math.max(right, x + 1);
      }
    }
  }
  if (right <= left) throw new Error("no ink in the screenshot");
  return ((left + right) / 2 - bitmap.width / 2) / bitmap.width;
}

function inkOffsets(elements: readonly HTMLElement[]): Promise<number[]> {
  return Promise.all(elements.map((element) => inkOffset(element)));
}

test("centers upright glyphs the bundled font lacks, in body text and ruby", async ({
  typography,
}) => {
  // ⓐ と ř は倫明朝に無く、á は倫明朝にある
  const parsed = parseManuscript("あⓐいá\n[[rb:作曲家 > Dvořák]]", { parser: pixivParser });
  expect.assert(parsed.ok);
  const composed = composeManuscript(parsed.value, {
    composer: typography.composer,
    settings: {
      ...NovelCompositionSettings.defaults,
      appearance: { ...NovelCompositionSettings.defaults.appearance, fontPreset: "mincho" },
    },
  });
  expect.assert(composed.ok);

  const screen = await render(<NovelViewer composed={composed.value} typography={typography} />);
  // 左右のずれは整数ピクセルへの丸めから出るので、レイアウトはそのままに拡大して字面を測る
  screen.container.style.transform = "scale(8)";
  screen.container.style.transformOrigin = "0 0";

  const fallbacks = Array.from(
    screen.container.querySelectorAll<HTMLElement>(".kgv-glyph-fallback"),
  );
  expect(fallbacks.map((element) => element.dataset["text"] ?? element.textContent)).toEqual([
    "ⓐ",
    "ř",
  ]);
  // 同梱フォントにある字には、代替フォントの扱いを付けない
  const bundled = Array.from(screen.container.querySelectorAll<HTMLElement>(".kgv-glyph")).filter(
    (element) => element.textContent === "á",
  );
  expect(bundled.length).toBeGreaterThan(0);
  for (const element of bundled)
    expect(element.classList.contains("kgv-glyph-fallback")).toBe(false);
  // 選択、コピー、検索のために、字は DOM のテキストのまま残す
  expect(screen.container.textContent).toContain("あⓐいá");
  // 字面の中心がこまの中央から 0.05em 以内にある
  await expect
    .poll(() => inkOffsets(fallbacks))
    .toSatisfy((offsets: number[]) => offsets.every((offset) => Math.abs(offset) <= 0.05));
});
