import {
  composeManuscript,
  NovelCompositionSettings,
  parseManuscript,
  pixivParser,
} from "@sushichan044/kg-core";
import { expect, test as base } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import fontUrl from "../assets/GenEiKoburiMin6-R.ttf?url";
import { createWorkerEngine } from "./manuscript-engine";
import { NovelViewer } from "./NovelViewer";
import { loadRenderTypography } from "./typography";
import { loadTypography } from "./typography";
import type { ReadyTypography } from "./typography";

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

// 向きを固定するこまと分割しない書記素（半角、絵文字、結合文字）を混ぜ、複数行に折り返す
const body =
  "名前はまだ無い。…Hello,world―ｱ🦄が゙12officeで終わる。どこで生れたかとんと見当がつかぬ。";

const cases = [
  { name: "plain text", source: body, expected: body },
  {
    name: "ruby",
    source: `吾輩は[[rb:猫>ねこ]]である。${body}`,
    expected: `吾輩は猫である。${body}`,
  },
] as const;

// 行の切れ目の改行はエンジン次第で入る。ルビの読みは、従来から折り返し位置によって選択範囲に混ざる
const bodyOnly = (text: string) => text.replaceAll(/[\n\r]|ねこ/g, "");

test.for(cases)("copies the manuscript text in order ($name)", async (found, { typography }) => {
  const parsed = parseManuscript(found.source, { parser: pixivParser });
  expect.assert(parsed.ok);
  const composed = composeManuscript(parsed.value, {
    composer: typography.composer,
    settings: NovelCompositionSettings.forPaper("a4", {
      ...NovelCompositionSettings.defaults,
      appearance: { ...NovelCompositionSettings.defaults.appearance, fontPreset: "genei-koburi" },
      flow: { lineLengthEm: 10, linesPerStage: 10, stagesPerPage: 1 },
    }),
  });
  expect.assert(composed.ok);
  const screen = await render(
    <>
      <NovelViewer composed={composed.value} typography={typography} />
      <textarea aria-label="paste target" />
    </>,
  );
  expect(screen.container.querySelectorAll(".kgv-line-text").length).toBeGreaterThan(1);
  const glyphs = screen.container.querySelectorAll<HTMLElement>(".kgv-glyph");
  const first = glyphs[0]?.firstChild;
  const last = glyphs[glyphs.length - 1]?.firstChild;
  expect.assert(first != null && last != null);
  const selection = window.getSelection();
  expect.assert(selection !== null);

  selection.setBaseAndExtent(first, 0, last, last.textContent?.length ?? 0);
  const selected = selection.toString();
  const cloned = selection.getRangeAt(0).cloneContents().textContent;
  await userEvent.copy();
  const target = screen.getByLabelText("paste target");
  await target.click();
  await userEvent.paste();

  expect(bodyOnly(selected)).toBe(found.expected);
  expect(bodyOnly(cloned)).toBe(found.expected);
  expect(bodyOnly((target.element() as HTMLTextAreaElement).value)).toBe(found.expected);
});

test("copies the manuscript text in order when the worker composed it", async () => {
  const engine = createWorkerEngine(
    () => new Worker(new URL("./fixtures/kg.worker.ts", import.meta.url), { type: "module" }),
  );
  const settings = NovelCompositionSettings.forPaper("a4", {
    ...NovelCompositionSettings.defaults,
    appearance: { ...NovelCompositionSettings.defaults.appearance, fontPreset: "genei-koburi" },
    flow: { lineLengthEm: 10, linesPerStage: 10, stagesPerPage: 1 },
  });
  const outcome = await engine.process({ source: body, notation: "pixiv", settings });
  const rendering = await loadRenderTypography({
    fontPreset: "genei-koburi",
    fontUrls: { 400: fontUrl },
  });
  engine.dispose();
  expect.assert(outcome.ok);
  expect.assert(rendering.ok);
  const screen = await render(
    <>
      <NovelViewer composed={outcome.value.composed} typography={rendering.value} />
      <textarea aria-label="paste target" />
    </>,
  );
  const glyphs = screen.container.querySelectorAll<HTMLElement>(".kgv-glyph");
  const first = glyphs[0]?.firstChild;
  const last = glyphs[glyphs.length - 1]?.firstChild;
  expect.assert(first != null && last != null);
  const selection = window.getSelection();
  expect.assert(selection !== null);

  selection.setBaseAndExtent(first, 0, last, last.textContent?.length ?? 0);
  const selected = selection.toString();
  await userEvent.copy();
  const target = screen.getByLabelText("paste target");
  await target.click();
  await userEvent.paste();

  expect(bodyOnly(selected)).toBe(body);
  expect(bodyOnly((target.element() as HTMLTextAreaElement).value)).toBe(body);
  rendering.value.dispose();
});
