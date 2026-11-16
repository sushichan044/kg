import {
  composeManuscript,
  NovelCompositionSettings,
  parseManuscript,
  pixivParser,
} from "@sushichan044/kg-core";
import { expect, test as base } from "vite-plus/test";
import { server, userEvent } from "vite-plus/test/browser";
import type { Locator } from "vite-plus/test/browser";
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
  {
    name: "word spaces",
    source: "英字はHello, Worldのように組む。記号：α β γ、±×÷も確かめる。",
    expected: "英字はHello, Worldのように組む。記号：α β γ、±×÷も確かめる。",
  },
  {
    name: "tate-chu-yoko",
    source: "数字は25歳と60人!?と数えて組む。",
    expected: "数字は25歳と60人!?と数えて組む。",
    // WebKit は縦中横のテキストを選択範囲の文字列で U+FFFC に置き換える（コピーはビューアーが直す）
    selectedInWebKit: "数字は￼歳と￼人￼と数えて組む。",
  },
  {
    name: "space after a question mark",
    source: "「待って！？　それ、本当なの……？」",
    expected: "「待って！？　それ、本当なの……？」",
    selectedInWebKit: "「待って￼　それ、本当なの……？」",
  },
  {
    name: "paragraphs",
    source: "あいうえおかきくけこさしすせそ\nたちつてと",
    expected: "あいうえおかきくけこさしすせそ\nたちつてと",
  },
  {
    // 段落の最後の行が詰めて行長に収まると、行の調整は shrunk になる
    name: "paragraph ending on a shrunk line",
    source: "ああ、ああああああ。」\nたちつてと",
    expected: "ああ、ああああああ。」\nたちつてと",
  },
  {
    name: "blank line",
    source: "あいうえおかきくけこさ\n\nたちつてと",
    expected: "あいうえおかきくけこさ\n\nたちつてと",
  },
] as const;

// 選択範囲の文字列には、行の切れ目ごとに改行が入る
const bodyOnly = (text: string) => text.replaceAll(/[\n\r]/g, "");

function compose(
  source: string,
  typography: ReadyTypography,
  overrides: Partial<Pick<NovelCompositionSettings, "flow" | "offsets">> = {},
) {
  const parsed = parseManuscript(source, { parser: pixivParser });
  expect.assert(parsed.ok);
  const composed = composeManuscript(parsed.value, {
    composer: typography.composer,
    settings: NovelCompositionSettings.forPaper("a4", {
      ...NovelCompositionSettings.defaults,
      appearance: { ...NovelCompositionSettings.defaults.appearance, fontPreset: "genei-koburi" },
      flow: { lineLengthEm: 10, linesPerStage: 10, stagesPerPage: 1 },
      ...overrides,
    }),
  });
  expect.assert(composed.ok);
  return composed.value;
}

async function pasteClipboard(target: Locator): Promise<string> {
  await userEvent.copy();
  await target.click();
  await userEvent.paste();
  return (target.element() as HTMLTextAreaElement).value;
}

// WebKit は貼り付けるときに末尾の改行を落とすので、コピーした文字列はクリップボードから直接読む
async function copiedText(): Promise<string | undefined> {
  let copied: string | undefined;
  const capture = (event: ClipboardEvent) => {
    copied = event.clipboardData?.getData("text/plain");
  };
  document.addEventListener("copy", capture);
  try {
    await userEvent.copy();
  } finally {
    document.removeEventListener("copy", capture);
  }
  return copied;
}

test.for(cases)("copies the manuscript text in order ($name)", async (found, { typography }) => {
  const screen = await render(
    <>
      <NovelViewer composed={compose(found.source, typography)} typography={typography} />
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
  const pasted = await pasteClipboard(screen.getByLabelText("paste target"));

  const expectedSelection =
    server.browser === "webkit" && "selectedInWebKit" in found
      ? found.selectedInWebKit
      : found.expected;
  expect(bodyOnly(selected)).toBe(bodyOnly(expectedSelection));
  expect(cloned).toBe(bodyOnly(found.expected));
  expect(pasted).toBe(found.expected);
});

test("copies a space that the line break removed", async ({ typography }) => {
  const source = "あいうえおかきくけ！？　こさしすせそ";
  const composed = compose(source, typography);
  const suppressed = composed.layout.pages
    .flatMap(({ stages }) => stages.flatMap(({ lines }) => lines.flatMap(({ items }) => items)))
    .filter((item) => item.kind === "suppressed");
  expect.assert(suppressed.length === 1);
  const screen = await render(
    <>
      <NovelViewer composed={composed} typography={typography} />
      <textarea aria-label="paste target" />
    </>,
  );
  const page = screen.container.querySelector(".kgv-page");
  expect.assert(page !== null);
  const selection = window.getSelection();
  expect.assert(selection !== null);

  selection.selectAllChildren(page);
  const selected = selection.toString();
  const pasted = await pasteClipboard(screen.getByLabelText("paste target"));

  expect(bodyOnly(selected)).toBe(
    server.browser === "webkit" ? "あいうえおかきくけ￼　こさしすせそ" : source,
  );
  expect(pasted).toBe(source);
});

test("copies only the manuscript text when the whole page is selected", async ({ typography }) => {
  const screen = await render(
    <>
      <NovelViewer
        composed={compose(
          "　[[rb:組版見本 > くみはんみほん]]を確かめる。Hello, World、25歳",
          typography,
        )}
        typography={typography}
      />
      <textarea aria-label="paste target" />
    </>,
  );
  const page = screen.container.querySelector(".kgv-page");
  expect.assert(page !== null);
  const selection = window.getSelection();
  expect.assert(selection !== null);

  selection.selectAllChildren(page);
  const selected = selection.toString();
  const pasted = await pasteClipboard(screen.getByLabelText("paste target"));

  expect(bodyOnly(selected)).toBe(
    server.browser === "webkit"
      ? "　組版見本を確かめる。Hello, World、￼歳"
      : "　組版見本を確かめる。Hello, World、25歳",
  );
  expect(pasted).toBe("　組版見本を確かめる。Hello, World、25歳");
});

const paddingCases = [
  { name: "trailing blank lines", source: "本文\n\n\n", settings: {}, expected: "本文\n\n" },
  {
    name: "document offsets",
    source: "本文\n\n",
    settings: {
      offsets: {
        ...NovelCompositionSettings.defaults.offsets,
        document: { leading: 1, trailing: 1 },
      },
    },
    expected: "本文\n",
  },
  {
    name: "stage offsets",
    // 各段に1行だけ組み、残りの9行を空ける
    source: "あいうえおかきくけこさしすせそたちつてと\n",
    settings: {
      flow: { lineLengthEm: 10, linesPerStage: 10, stagesPerPage: 2 },
      offsets: {
        ...NovelCompositionSettings.defaults.offsets,
        stage: { leading: 0, trailing: 9 },
      },
    },
    expected: "あいうえおかきくけこさしすせそたちつてと",
  },
] as const;

test.for(paddingCases)(
  "copies blank manuscript lines but not the layout padding ($name)",
  async (found, { typography }) => {
    const screen = await render(
      <NovelViewer
        composed={compose(found.source, typography, found.settings)}
        typography={typography}
      />,
    );
    const page = screen.container.querySelector(".kgv-page");
    expect.assert(page !== null);
    const selection = window.getSelection();
    expect.assert(selection !== null);

    selection.selectAllChildren(page);
    const copied = await copiedText();

    expect(copied).toBe(found.expected);
  },
);

test("keeps the page text available to assistive technology", async ({ typography }) => {
  const screen = await render(
    <NovelViewer
      composed={compose("[[rb:組版見本 > くみはんみほん]]、Hello, World、25歳", typography)}
      typography={typography}
    />,
  );

  const text = screen.container.querySelector(".kgv-page-text");

  expect.assert(text !== null);
  // 計算値は CSS の文字列で、行の切れ目の改行は `\a ` になる
  expect(getComputedStyle(text, "::before").content.replaceAll("\\a ", "")).toBe(
    JSON.stringify("組版見本、Hello, World、25歳"),
  );
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
  const pasted = await pasteClipboard(screen.getByLabelText("paste target"));

  expect(bodyOnly(selected)).toBe(body);
  expect(pasted).toBe(body);
  rendering.value.dispose();
});
