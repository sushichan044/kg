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

const defaultZoom = {
  value: 100,
  min: 50,
  max: 150,
  step: 25,
  onChange: () => {},
};

type ViewerFixtureProps = Omit<ManuscriptViewerProps, "composed" | "diagnostics" | "zoom"> &
  Readonly<{ zoom?: ManuscriptViewerProps["zoom"] }>;

async function renderViewer(
  options: ViewerFixtureOptions,
  { zoom = defaultZoom, ...props }: ViewerFixtureProps = {},
) {
  const parsed = parseManuscript(options.text ?? "", { parser: options.parser });
  expect.assert(parsed.ok, "fixture did not parse");

  const composed = composeManuscript(parsed.value, {
    composer: manuscriptGridComposer,
    settings: {
      grid: options.settings ?? ManuscriptCompositionSettings.defaults.grid,
      offsets: options.offsets ?? ManuscriptCompositionSettings.defaults.offsets,
      appearance: options.appearance ?? ManuscriptCompositionSettings.defaults.appearance,
    },
  });
  expect.assert(composed.ok, "fixture setup failed");

  const proofread = proofreadManuscript(composed.value, {
    rules: createDefaultProofreadingRules(),
  });
  expect.assert(proofread.ok, "fixture did not proofread");

  const diagnostics = [...parsed.warnings, ...proofread.value];
  const screen = await render(
    <ManuscriptViewer composed={composed.value} diagnostics={diagnostics} zoom={zoom} {...props} />,
  );

  return { composed: composed.value, diagnostics, screen };
}

test("renders the first grapheme in the top-right cell with square geometry", async () => {
  const { screen } = await renderViewer({ text: "あいうえ", settings });

  const cells = Array.from(screen.container.querySelectorAll<HTMLElement>(".kgv-cell"));
  const occupied = cells.filter((cell) => cell.textContent !== "");
  const firstOccupied = occupied[0];
  const secondOccupied = occupied[1];
  expect.assert(firstOccupied !== undefined, "grid has no first occupied cell");
  expect.assert(secondOccupied !== undefined, "grid has no second occupied cell");

  const firstCell = cells[0];
  const eleventhCell = cells[10];
  expect.assert(firstCell !== undefined, "grid has no first cell");
  expect.assert(eleventhCell !== undefined, "grid has no eleventh cell");

  expect(firstOccupied.textContent).toBe("あ");
  expect(secondOccupied.textContent).toBe("い");
  const firstRect = firstCell.getBoundingClientRect();
  expect(firstRect.width).toBeCloseTo(firstRect.height, 0);
  expect(eleventhCell.getBoundingClientRect().left).toBeLessThan(firstRect.left);
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

  const firstDiagnostic = diagnostics[0];
  expect.assert(firstDiagnostic !== undefined, "fixture produced no diagnostics");
  expect(screen.container.querySelectorAll("[data-diagnostic]")).not.toHaveLength(0);

  await screen.getByRole("button").first().click();

  expect(selected).toBe(firstDiagnostic.id);
  expect(screen.container.textContent).toContain(text);
});

test("marks an entire emoji variation sequence as one diagnostic", async () => {
  const { diagnostics, screen } = await renderViewer({ text: "　⭐️", settings });

  const diagnostic = diagnostics.find(({ origin }) => origin.id === "kg/variant-character");
  expect.assert(diagnostic !== undefined, "fixture produced no variant-character diagnostic");
  expect(diagnostic.range.source).toEqual({ start: 1, end: 3 });

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
  expect.assert(nested !== undefined, "fixture produced no nested punctuation diagnostic");
  expect(diagnostics).toHaveLength(2);

  const markers = screen.container.querySelectorAll<HTMLButtonElement>(".kgv-diagnostic-marker");
  expect(markers).toHaveLength(2);
  const secondMarker = markers[1];
  expect.assert(secondMarker !== undefined, "grid has no second diagnostic marker");

  secondMarker.click();

  expect(selected).toBe(nested.id);
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
  expect.assert(ruby !== null, "ruby annotation did not render");
  expect.assert(bold !== null, "bold annotation did not render");
  expect.assert(italic !== null, "italic annotation did not render");
  expect.assert(emphasis !== null, "emphasis annotation did not render");

  const rubyReading = ruby.querySelector<HTMLElement>(".kgv-ruby");
  expect.assert(rubyReading !== null, "ruby reading did not render");

  const hiddenText = screen.container.querySelector(".kgv-visually-hidden");
  expect.assert(hiddenText !== null, "accessible viewer text did not render");

  expect(rubyReading.textContent).toBe("かんじ");
  // Where the reading sits along its base is pinned by the two tests below this one.
  expect(rubyReading.getBoundingClientRect().left).toBeGreaterThanOrEqual(
    ruby.getBoundingClientRect().right,
  );
  expect(getComputedStyle(bold).fontWeight).toBe("700");
  expect(getComputedStyle(italic).fontStyle).toBe("italic");
  expect(getComputedStyle(emphasis).textEmphasisStyle).toContain("・");
  expect(hiddenText.textContent.replace(/\n+$/, "")).toBe("漢字太字斜体強調");
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

  const cellElement = screen.container.querySelector<HTMLElement>(".kgv-cell");
  const baseElement = screen.container.querySelector<HTMLElement>('[data-annotation="ruby"]');
  const readingElement = screen.container.querySelector<HTMLElement>(".kgv-ruby");
  expect.assert(cellElement !== null, "cell did not render");
  expect.assert(baseElement !== null, "ruby annotation did not render");
  expect.assert(readingElement !== null, "ruby reading did not render");

  const cell = cellElement.getBoundingClientRect();
  const base = baseElement.getBoundingClientRect();
  const reading = readingElement.getBoundingClientRect();

  // The reading starts where its base ends…
  expect(reading.left).toBeGreaterThanOrEqual(base.right);
  // …and is narrower than one cell, so it cannot cover the line written before it.
  expect(reading.width).toBeLessThan(cell.width);
});

test("centres each reading character on its own cell when the counts match", async () => {
  // 仮名 / かな: two characters read as two, so each reading character belongs to one of them.
  const { screen } = await renderViewer({
    text: "[[rb:仮名 > かな]]",
    settings,
    parser: pixivParser,
  });

  const base = screen.container.querySelector<HTMLElement>('[data-annotation="ruby"]');
  expect.assert(base !== null, "ruby annotation did not render");
  expect(base.dataset.rubyFit).toBe("mono");

  const cells = Array.from(base.querySelectorAll<HTMLElement>(".kgv-cell"));
  const reading = Array.from(base.querySelectorAll<HTMLElement>(".kgv-ruby-character"));
  const centreOf = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return rect.top + rect.height / 2;
  };

  expect(reading).toHaveLength(cells.length);
  for (const [index, cell] of cells.entries()) {
    const readingCharacter = reading[index];
    expect.assert(
      readingCharacter !== undefined,
      `ruby reading has no character at index ${index}`,
    );
    expect(centreOf(readingCharacter)).toBeCloseTo(centreOf(cell), 0);
  }
});

test("spreads a ruby reading across exactly the characters it annotates", async () => {
  const { screen } = await renderViewer({
    // Three kana over a two-character base: shorter than its base unless it is spread out.
    text: "[[rb:漢字 > かんじ]]あ",
    settings,
    parser: pixivParser,
  });

  // The group reading is inset from its first and last cells by the same margin that makes glyphs
  // smaller than their cells. Cell geometry is stable across font fallbacks; glyph rectangles are
  // not, even with identical font-size and line-height declarations.
  const base = screen.container.querySelector<HTMLElement>('[data-annotation="ruby"]');
  expect.assert(base !== null, "ruby annotation did not render");

  const baseGlyphs = Array.from(base.querySelectorAll<HTMLElement>(".kgv-glyph"));
  const firstGlyph = baseGlyphs[0];
  const lastGlyph = baseGlyphs.at(-1);
  expect.assert(firstGlyph !== undefined, "ruby base has no first glyph");
  expect.assert(lastGlyph !== undefined, "ruby base has no last glyph");

  const firstCell = firstGlyph.closest<HTMLElement>(".kgv-cell");
  const lastCell = lastGlyph.closest<HTMLElement>(".kgv-cell");
  expect.assert(firstCell !== null, "first ruby glyph is not inside a cell");
  expect.assert(lastCell !== null, "last ruby glyph is not inside a cell");

  const reading = screen.container.querySelector<HTMLElement>(".kgv-ruby");
  const viewer = screen.container.querySelector<HTMLElement>(".kgv-viewer");
  expect.assert(reading !== null, "ruby reading did not render");
  expect.assert(viewer !== null, "viewer did not render");

  const glyphScale = Number.parseFloat(
    getComputedStyle(viewer).getPropertyValue("--kgv-glyph-scale"),
  );
  expect.assert(Number.isFinite(glyphScale), "viewer has no finite glyph scale");

  const firstRect = firstCell.getBoundingClientRect();
  const lastRect = lastCell.getBoundingClientRect();
  const readingRect = reading.getBoundingClientRect();
  const inset = (firstRect.height * (1 - glyphScale)) / 2;
  const topOffset = Math.abs(readingRect.top - firstRect.top - inset);
  const bottomOffset = Math.abs(readingRect.bottom - lastRect.bottom + inset);

  expect(topOffset).toBeLessThan(1);
  expect(bottomOffset).toBeLessThan(1);
});

test("sets a ruby reading at half the size of the characters it annotates", async () => {
  const { screen } = await renderViewer({
    text: "[[rb:漢字 > かんじ]]",
    settings,
    parser: pixivParser,
  });

  const glyph = screen.container.querySelector<HTMLElement>(".kgv-glyph");
  const reading = screen.container.querySelector<HTMLElement>(".kgv-ruby");
  expect.assert(glyph !== null, "glyph did not render");
  expect.assert(reading !== null, "ruby reading did not render");

  expect(Number.parseFloat(getComputedStyle(reading).fontSize)).toBeCloseTo(
    Number.parseFloat(getComputedStyle(glyph).fontSize) / 2,
    1,
  );
});

test("splits annotations at line boundaries and repeats ruby readings", async () => {
  const { screen } = await renderViewer({
    text: "[[rb:一二三四五六七八九十一二 > いちにさんしごろくしちはちきゅうじゅういちに]]",
    settings,
    parser: pixivParser,
  });

  const rubyFragments = screen.container.querySelectorAll<HTMLElement>('[data-annotation="ruby"]');
  expect(rubyFragments).toHaveLength(2);
  expect(
    Array.from(rubyFragments, (ruby) => {
      const reading = ruby.querySelector(".kgv-ruby");
      expect.assert(reading !== null, "ruby fragment has no reading");

      return reading.textContent;
    }),
  ).toEqual([
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
  expect.assert(emphasis !== null, "emphasis annotation did not render");

  expect(getComputedStyle(emphasis).textEmphasisStyle).toContain('"');
  expect(emphasis.textContent).toBe("引用");
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
  expect.assert(cell !== null, "cell did not render");

  // 10pt = 10 * (96 / 72) CSS px ≈ 13.33px.
  expect(cell.getBoundingClientRect().width).toBeCloseTo((10 * 96) / 72, 0);
});

test("scales cells to a magnification outside the built-in scale", async () => {
  const { screen } = await renderViewer(
    {
      text: "あ",
      settings,
      appearance: { ...ManuscriptAppearanceSettings.defaults, fontSizePt: 10 },
    },
    { zoom: { ...defaultZoom, value: 90 } },
  );

  const cell = screen.container.querySelector<HTMLElement>(".kgv-cell");
  expect.assert(cell !== null, "cell did not render");

  expect(cell.getBoundingClientRect().width).toBeCloseTo(((10 * 96) / 72) * 0.9, 0);
});

test("renders each vertical line as an independent grid with a half-em gap", async () => {
  const { screen } = await renderViewer({
    text: "あ",
    settings,
    appearance: { ...ManuscriptAppearanceSettings.defaults, fontSizePt: 12 },
  });

  const lines = screen.container.querySelectorAll<HTMLElement>(".kgv-line");
  const firstLine = lines[0];
  const secondLine = lines[1];
  expect.assert(firstLine !== undefined, "grid has no first line");
  expect.assert(secondLine !== undefined, "grid has no second line");

  const firstLineCell = firstLine.querySelector<HTMLElement>(".kgv-cell");
  expect.assert(firstLineCell !== null, "first line has no cell");

  const first = firstLine.getBoundingClientRect();
  const second = secondLine.getBoundingClientRect();
  const cellSize = firstLineCell.getBoundingClientRect().width;

  expect(first.right).toBeGreaterThan(second.right);
  expect(first.left - second.left).toBeCloseTo(first.width + cellSize * 0.5, 0);
  expect(getComputedStyle(firstLine).borderInlineEndWidth).toBe("1px");
});

test("renders offset-reserved leading cells as empty", async () => {
  const offsets: ManuscriptOffsets = {
    document: { leading: 1, trailing: 0 },
    page: { leading: 0, trailing: 0 },
    stage: { leading: 0, trailing: 0 },
  };

  const { screen } = await renderViewer({ text: "あいうえ", settings, offsets });

  const lines = Array.from(screen.container.querySelectorAll<HTMLElement>(".kgv-line"));
  const firstLine = lines[0];
  const secondLine = lines[1];
  expect.assert(firstLine !== undefined, "grid has no first line");
  expect.assert(secondLine !== undefined, "grid has no second line");

  const firstLineCells = Array.from(firstLine.querySelectorAll<HTMLElement>(".kgv-cell"));
  expect(firstLineCells.every((cell) => cell.textContent === "")).toBe(true);

  const secondLineCells = Array.from(secondLine.querySelectorAll<HTMLElement>(".kgv-cell"));
  expect(secondLineCells.slice(0, 3).map((cell) => cell.textContent)).toEqual(["あ", "い", "う"]);
});
