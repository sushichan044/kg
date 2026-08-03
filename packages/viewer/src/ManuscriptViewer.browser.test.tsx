import {
  ManuscriptAppearanceSettings,
  ManuscriptCompositionSettings,
  composeManuscript,
  createDefaultProofreadingRules,
  manuscriptGridComposer,
  parseManuscript,
  pixivParser,
  proofreadManuscript,
} from "@sushichan044/kg-core";
import type { GridSettings, ManuscriptOffsets, ManuscriptParser } from "@sushichan044/kg-core";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { ManuscriptViewer } from "./ManuscriptViewer";
import type { ManuscriptViewerProps } from "./ManuscriptViewer";

import "./styles.css";

const settings: GridSettings = {
  charsPerLine: 10,
  linesPerStage: 10,
  stagesPerPage: 1,
};

type ViewerFixtureOptions = Readonly<{
  text?: string;
  settings?: GridSettings;
  offsets?: ManuscriptOffsets;
  appearance?: ManuscriptAppearanceSettings;
  parser?: ManuscriptParser;
}>;

async function renderViewer(
  options: ViewerFixtureOptions,
  props: Omit<ManuscriptViewerProps, "composed" | "diagnostics"> = {},
) {
  const parsed = parseManuscript(options.text ?? "", { parser: options.parser });
  if (!parsed.ok) throw new Error("fixture did not parse");
  const composed = composeManuscript(parsed.value, {
    composer: manuscriptGridComposer,
    settings: {
      grid: options.settings ?? ManuscriptCompositionSettings.defaults.grid,
      offsets: options.offsets ?? ManuscriptCompositionSettings.defaults.offsets,
      appearance: options.appearance ?? ManuscriptCompositionSettings.defaults.appearance,
    },
  });
  if (!composed.ok) throw new Error("fixture setup failed");
  const proofread = proofreadManuscript(composed.value, {
    rules: createDefaultProofreadingRules(),
  });
  if (!proofread.ok) throw new Error("fixture did not proofread");
  const diagnostics = [...parsed.warnings, ...proofread.value];
  const screen = await render(
    <ManuscriptViewer composed={composed.value} diagnostics={diagnostics} {...props} />,
  );

  return { composed: composed.value, diagnostics, screen };
}

test("renders the first grapheme in the top-right cell with square geometry", async () => {
  const { screen } = await renderViewer({ text: "あいうえ", settings });

  const cells = Array.from(screen.container.querySelectorAll<HTMLElement>(".kgv-cell"));
  const occupied = cells.filter((cell) => cell.textContent !== "");
  expect(occupied[0]?.textContent).toBe("あ");
  expect(occupied[1]?.textContent).toBe("い");
  const firstRect = cells[0]?.getBoundingClientRect();
  expect(firstRect?.width).toBeCloseTo(firstRect?.height ?? 0, 0);
  expect(cells[10]?.getBoundingClientRect().left).toBeLessThan(
    cells[0]?.getBoundingClientRect().left ?? 0,
  );
});

test("marks diagnostics and selects them without changing the manuscript", async () => {
  const text = "「誤り。。。 」";
  let selected = "";
  const { diagnostics, screen } = await renderViewer(
    { text, settings },
    {
      onDiagnosticSelect: (diagnostic) => {
        selected = diagnostic.id;
      },
    },
  );

  expect(screen.container.querySelectorAll("[data-diagnostic]")).not.toHaveLength(0);
  await screen.getByRole("button").first().click();
  expect(selected).toBe(diagnostics[0]?.id);
  expect(screen.container.textContent).toContain(text);
});

test("marks an entire emoji variation sequence as one diagnostic", async () => {
  const { diagnostics, screen } = await renderViewer({ text: "　⭐️", settings });

  const diagnostic = diagnostics.find(({ origin }) => origin.id === "kg/variant-character");
  expect(diagnostic?.range.source).toEqual({ start: 1, end: 3 });

  const occupiedCells = Array.from(
    screen.container.querySelectorAll<HTMLElement>(".kgv-cell"),
  ).filter((cell) => cell.textContent !== "");
  expect(occupiedCells.map((cell) => cell.textContent)).toEqual(["　", "⭐️"]);
  expect(occupiedCells[1]).toHaveAttribute("data-diagnostic");
});

test("selects the diagnostic that starts in the clicked cell when ranges are nested", async () => {
  // 「あ、。。」 raises a closing-quote diagnostic over 、。。 and a consecutive-punctuation
  // diagnostic over 。。 nested inside it, each starting in a different cell.
  let selected = "";
  const { diagnostics, screen } = await renderViewer(
    { text: "「あ、。。」", settings },
    {
      onDiagnosticSelect: (diagnostic) => {
        selected = diagnostic.id;
      },
    },
  );

  const nested = diagnostics.find(({ origin }) => origin.id === "kg/no-consecutive-punctuation");
  expect(diagnostics).toHaveLength(2);

  const markers = screen.container.querySelectorAll<HTMLButtonElement>(".kgv-diagnostic-marker");
  expect(markers).toHaveLength(2);
  markers[1]?.click();
  expect(selected).toBe(nested?.id);
});

test("names the diagnostic each marker stands for", async () => {
  const { diagnostics, screen } = await renderViewer({ text: "「あ、。。」", settings });

  const markers = Array.from(
    screen.container.querySelectorAll<HTMLButtonElement>(".kgv-diagnostic-marker"),
  );
  expect(markers.map((marker) => marker.dataset.diagnosticId)).toEqual(
    diagnostics.map(({ id }) => id),
  );
});

test("renders the four supported pixiv notation forms without exposing their tags", async () => {
  const source = "[[rb:漢字 > かんじ]][b:太字][i:斜体][[emphasismark:強調>・]]";
  const { screen } = await renderViewer({ text: source, settings, parser: pixivParser });

  const ruby = screen.container.querySelector<HTMLElement>('[data-annotation="ruby"]');
  const bold = screen.container.querySelector<HTMLElement>('[data-annotation="bold"]');
  const italic = screen.container.querySelector<HTMLElement>('[data-annotation="italic"]');
  const emphasis = screen.container.querySelector<HTMLElement>('[data-annotation="emphasis"]');
  const rubyReading = ruby?.querySelector<HTMLElement>("rt");

  expect(rubyReading?.textContent).toBe("かんじ");
  expect(rubyReading?.getBoundingClientRect().top).toBeCloseTo(
    ruby?.getBoundingClientRect().top ?? 0,
    0,
  );
  expect(rubyReading?.getBoundingClientRect().left).toBeGreaterThanOrEqual(
    ruby?.getBoundingClientRect().right ?? 0,
  );
  expect(getComputedStyle(bold!).fontWeight).toBe("700");
  expect(getComputedStyle(italic!).fontStyle).toBe("italic");
  expect(getComputedStyle(emphasis!).textEmphasisStyle).toContain("・");
  expect(
    screen.container.querySelector(".kgv-visually-hidden")?.textContent.replace(/\n+$/, ""),
  ).toBe("漢字太字斜体強調");
  expect(screen.container.textContent).not.toContain("[[rb:");
  expect(screen.container.textContent).not.toContain("[b:");
  expect(screen.container.textContent).not.toContain("[i:");
  expect(screen.container.textContent).not.toContain("[[emphasismark:");
});

test("keeps a ruby reading within the gap beside its own line", async () => {
  const { screen } = await renderViewer({
    text: "[[rb:漢字 > かんじ]]あ",
    settings,
    parser: pixivParser,
  });

  const cell = screen.container.querySelector<HTMLElement>(".kgv-cell")!.getBoundingClientRect();
  const base = screen.container
    .querySelector<HTMLElement>('[data-annotation="ruby"]')!
    .getBoundingClientRect();
  const reading = screen.container.querySelector<HTMLElement>("rt")!.getBoundingClientRect();

  // The reading runs alongside the base characters, so it is as tall as they are…
  expect(reading.height).toBeCloseTo(base.height, 0);
  // …and no wider than one cell, or it would cover the line written before it.
  expect(reading.width).toBeLessThan(cell.width);
});

test("spreads a ruby reading over the cells its base occupies", async () => {
  const { screen } = await renderViewer({
    // Three kana over a two-character base: shorter than its base unless it is spread out.
    text: "[[rb:漢字 > かんじ]]あ",
    settings,
    parser: pixivParser,
  });

  const base = screen.container
    .querySelector<HTMLElement>('[data-annotation="ruby"]')!
    .getBoundingClientRect();
  const reading = screen.container.querySelector<HTMLElement>("rt")!;
  const range = document.createRange();
  range.selectNodeContents(reading);
  const glyphs = range.getBoundingClientRect();

  expect(glyphs.height).toBeCloseTo(base.height, 0);
});

test("splits annotations at line boundaries and repeats ruby readings", async () => {
  const { screen } = await renderViewer({
    text: "[[rb:一二三四五六七八九十一二 > いちにさんしごろくしちはちきゅうじゅういちに]]",
    settings,
    parser: pixivParser,
  });

  const rubyFragments = screen.container.querySelectorAll<HTMLElement>('[data-annotation="ruby"]');
  expect(rubyFragments).toHaveLength(2);
  expect(Array.from(rubyFragments, (ruby) => ruby.querySelector("rt")?.textContent)).toEqual([
    "いちにさんしごろくしちはちきゅうじゅういちに",
    "いちにさんしごろくしちはちきゅうじゅういちに",
  ]);
  expect(Array.from(rubyFragments, (ruby) => ruby.querySelectorAll(".kgv-cell").length)).toEqual([
    10, 2,
  ]);
});

test("escapes an emphasis mark before using it as a CSS string", async () => {
  const { screen } = await renderViewer({
    text: '[[emphasismark:引用>"]] ',
    settings,
    parser: pixivParser,
  });

  const emphasis = screen.container.querySelector<HTMLElement>('[data-annotation="emphasis"]');
  expect(getComputedStyle(emphasis!).textEmphasisStyle).toContain('"');
  expect(emphasis?.textContent).toBe("引用");
});

test("keeps diagnostic selection working for decorated source ranges", async () => {
  let selectedRange: { start: number; end: number } | undefined;
  const { screen } = await renderViewer(
    { text: "[b:「あ、。。」]", settings, parser: pixivParser },
    {
      onDiagnosticSelect: (diagnostic) => {
        selectedRange = diagnostic.range.source;
      },
    },
  );

  await screen.getByRole("button").first().click();
  expect(selectedRange).toEqual({ start: 5, end: 8 });
  expect(
    screen.container.querySelector('[data-annotation="bold"] [data-diagnostic]'),
  ).not.toBeNull();
});

test("renders HTML-looking notation content as text instead of DOM", async () => {
  const source = "[b:<img src=x onerror=alert(1)>]";
  const { screen } = await renderViewer({ text: source, settings, parser: pixivParser });

  expect(screen.container.querySelector("img")).toBeNull();
  expect(
    Array.from(
      screen.container.querySelectorAll('[data-annotation="bold"]'),
      (fragment) => fragment.textContent,
    ).join(""),
  ).toBe("<img src=x onerror=alert(1)>");
});

test("renders a cell whose size in pixels matches the specified point size at 100% zoom", async () => {
  const { screen } = await renderViewer({
    text: "あ",
    settings,
    appearance: { ...ManuscriptAppearanceSettings.defaults, fontSizePt: 10 },
  });

  const cell = screen.container.querySelector<HTMLElement>(".kgv-cell");
  // 10pt = 10 * (96 / 72) CSS px ≈ 13.33px.
  expect(cell?.getBoundingClientRect().width).toBeCloseTo((10 * 96) / 72, 0);
});

test("scales cells to a magnification outside the built-in scale", async () => {
  const { screen } = await renderViewer(
    {
      text: "あ",
      settings,
      appearance: { ...ManuscriptAppearanceSettings.defaults, fontSizePt: 10 },
    },
    { zoom: { kind: "fixed", percent: 90 } },
  );

  const cell = screen.container.querySelector<HTMLElement>(".kgv-cell");
  expect(cell?.getBoundingClientRect().width).toBeCloseTo(((10 * 96) / 72) * 0.9, 0);
});

test("renders each vertical line as an independent grid with a half-em gap", async () => {
  const { screen } = await renderViewer({
    text: "あ",
    settings,
    appearance: { ...ManuscriptAppearanceSettings.defaults, fontSizePt: 12 },
  });

  const lines = screen.container.querySelectorAll<HTMLElement>(".kgv-line");
  const first = lines[0]?.getBoundingClientRect();
  const second = lines[1]?.getBoundingClientRect();
  const cellSize = lines[0]?.querySelector<HTMLElement>(".kgv-cell")?.getBoundingClientRect().width;

  expect(first?.right).toBeGreaterThan(second?.right ?? 0);
  expect((first?.left ?? 0) - (second?.left ?? 0)).toBeCloseTo(
    (first?.width ?? 0) + (cellSize ?? 0) * 0.5,
    0,
  );
  expect(getComputedStyle(lines[0]!).borderInlineEndWidth).toBe("1px");
});

test("renders offset-reserved leading cells as empty", async () => {
  const offsets: ManuscriptOffsets = {
    document: { leading: 1, trailing: 0 },
    page: { leading: 0, trailing: 0 },
    stage: { leading: 0, trailing: 0 },
  };

  const { screen } = await renderViewer({ text: "あいうえ", settings, offsets });

  const lines = Array.from(screen.container.querySelectorAll<HTMLElement>(".kgv-line"));
  const firstLineCells = Array.from(lines[0]?.querySelectorAll<HTMLElement>(".kgv-cell") ?? []);
  expect(firstLineCells.every((cell) => cell.textContent === "")).toBe(true);

  const secondLineCells = Array.from(lines[1]?.querySelectorAll<HTMLElement>(".kgv-cell") ?? []);
  expect(secondLineCells.slice(0, 3).map((cell) => cell.textContent)).toEqual(["あ", "い", "う"]);
});
