import {
  NovelCompositionSettings,
  composeManuscript,
  createDefaultProofreadingRules,
  kakuyomuParser,
  novelComposer,
  parseManuscript,
  pixivParser,
  proofreadManuscript,
} from "@sushichan044/kg-core";
import type {
  ManuscriptAppearanceSettings,
  ManuscriptDiagnostic,
  ManuscriptOffsets,
  ManuscriptParser,
  NovelFlowSettings,
} from "@sushichan044/kg-core";
import { useState } from "react";
import { expect, test as base } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { NovelViewer } from "./NovelViewer";
import type { NovelViewerProps } from "./NovelViewer";

import "./styles.css";

const flow: NovelFlowSettings = {
  lineLengthEm: 10,
  linesPerStage: 10,
  stagesPerPage: 1,
};

type ViewerFixtureOptions = Readonly<{
  text?: string;
  flow?: NovelFlowSettings;
  offsets?: ManuscriptOffsets;
  appearance?: ManuscriptAppearanceSettings;
  parser?: ManuscriptParser;
  reportedAs?: (found: readonly ManuscriptDiagnostic[]) => readonly ManuscriptDiagnostic[];
}>;

type ViewerFixtureProps = Omit<NovelViewerProps, "composed" | "diagnostics">;

async function renderViewer(options: ViewerFixtureOptions, props: ViewerFixtureProps = {}) {
  const parsed = parseManuscript(options.text ?? "", { parser: options.parser });
  expect.assert(parsed.ok, "fixture did not parse");

  const composed = composeManuscript(parsed.value, {
    composer: novelComposer,
    settings: {
      flow: options.flow ?? NovelCompositionSettings.defaults.flow,
      offsets: options.offsets ?? NovelCompositionSettings.defaults.offsets,
      appearance: options.appearance ?? NovelCompositionSettings.defaults.appearance,
    },
  });
  expect.assert(composed.ok, "fixture did not compose");

  const proofread = proofreadManuscript(composed.value, {
    rules: createDefaultProofreadingRules(),
  });
  expect.assert(proofread.ok, "fixture did not proofread");

  const found = [...parsed.warnings, ...proofread.value];
  const diagnostics = options.reportedAs?.(found) ?? found;
  const screen = await render(
    <NovelViewer composed={composed.value} diagnostics={diagnostics} {...props} />,
  );

  return { composed: composed.value, diagnostics, screen };
}

const test = base.extend<{ renderViewer: typeof renderViewer }>({
  renderViewer: async ({}, use) => {
    await use(renderViewer);
  },
});

test("gives upright Latin initials a full-width vertical advance", async ({ renderViewer }) => {
  const { screen } = await renderViewer({ text: "あBGMい", flow });
  const cells = Array.from(screen.container.querySelectorAll<HTMLElement>(".kgv-cell"));
  expect(cells.map(({ textContent }) => textContent)).toEqual(["あ", "B", "G", "M", "い"]);

  const [japanese, ...rest] = cells;
  expect.assert(japanese !== undefined, "viewer has no Japanese cell");
  const japaneseBounds = japanese.getBoundingClientRect();
  for (const cell of rest) {
    const cellBounds = cell.getBoundingClientRect();
    const glyph = cell.querySelector<HTMLElement>(".kgv-glyph");
    expect.assert(glyph !== null, "cell has no glyph");
    const glyphBounds = glyph.getBoundingClientRect();

    expect(cellBounds.height).toBeCloseTo(japaneseBounds.height, 1);
    expect(glyphBounds.top).toBeGreaterThanOrEqual(cellBounds.top - 0.5);
    expect(glyphBounds.bottom).toBeLessThanOrEqual(cellBounds.bottom + 0.5);
  }
});

test("composes a two-digit number as one tate-chu-yoko cell", async ({ renderViewer }) => {
  const { screen } = await renderViewer({ text: "あ12い", flow });
  const cells = Array.from(screen.container.querySelectorAll<HTMLElement>(".kgv-cell"));

  expect(cells.map(({ textContent }) => textContent)).toEqual(["あ", "12", "い"]);
  const [japanese, digits] = cells.map((cell) => cell.getBoundingClientRect());
  expect.assert(japanese !== undefined && digits !== undefined);
  expect(digits.height).toBeCloseTo(japanese.height, 1);
});

test("renders a hanging glyph from its render span", async ({ renderViewer }) => {
  const { composed, screen } = await renderViewer({ text: `${"あ".repeat(10)}。続き`, flow });
  const hanging = screen.container.querySelector<HTMLElement>(
    '.kgv-cell[data-disposition="hanging"]',
  );
  expect.assert(hanging !== null, "viewer has no hanging glyph");
  const firstContentLine = composed.layout.pages[0]?.stages[0]?.lines.find(
    ({ range }) => range !== null,
  );
  expect.assert(firstContentLine !== undefined, "layout has no content line");
  const hangingItem = firstContentLine.items.find(
    (item) => item.kind === "glyph" && item.disposition === "hanging",
  );
  expect.assert(hangingItem?.kind === "glyph", "layout has no hanging item");

  expect(hanging.style.getPropertyValue("--kgv-item-offset")).toBe(
    String(hangingItem.renderSpan.offsetEm),
  );
  expect(hanging.style.getPropertyValue("--kgv-item-advance")).toBe(
    String(hangingItem.renderSpan.advanceEm),
  );
  expect(hangingItem.layoutSpan.advanceEm).toBe(0);
  expect(hangingItem.renderSpan.advanceEm).toBe(1);
});

test("shows a nominal grid without letting it change text coordinates", async () => {
  const parsed = parseManuscript("あいう");
  expect.assert(parsed.ok, "fixture did not parse");
  const composed = composeManuscript(parsed.value, {
    composer: novelComposer,
    settings: { ...NovelCompositionSettings.defaults, flow },
  });
  expect.assert(composed.ok, "fixture did not compose");
  const composedManuscript = composed.value;

  function ToggleFixture() {
    const [showGrid, setShowGrid] = useState(true);
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setShowGrid((visible) => !visible);
          }}
        >
          マス目
        </button>
        <NovelViewer composed={composedManuscript} showGrid={showGrid} />
      </>
    );
  }

  const screen = await render(<ToggleFixture />);
  const glyph = screen.container.querySelector<HTMLElement>(".kgv-glyph");
  expect.assert(glyph !== null, "viewer has no glyph");
  const before = glyph.getBoundingClientRect();
  expect(screen.container.querySelectorAll(".kgv-rule-cell")).toHaveLength(100);

  await screen.getByRole("button", { name: "マス目" }).click();
  await expect.poll(() => screen.container.querySelectorAll(".kgv-rule-cell").length).toBe(0);
  const after = glyph.getBoundingClientRect();

  expect(after.top).toBeCloseTo(before.top, 1);
  expect(after.left).toBeCloseTo(before.left, 1);
  expect(after.width).toBeCloseTo(before.width, 1);
  expect(after.height).toBeCloseTo(before.height, 1);
});

test("renders the ruby kind and reading decided by core", async ({ renderViewer }) => {
  const { screen } = await renderViewer({
    text: "[[rb:仮名 > かな]]",
    flow,
    parser: pixivParser,
  });

  const ruby = screen.container.querySelector<HTMLElement>('[data-annotation="ruby"]');
  expect.assert(ruby !== null, "ruby did not render");
  expect(ruby.dataset.rubyFit).toBe("group");
  const reading = ruby.querySelector(".kgv-ruby");
  expect.assert(reading !== null, "ruby reading did not render");
  expect(reading.textContent).toBe("かな");
  expect(ruby.querySelectorAll(".kgv-ruby-character")).toHaveLength(2);
});

test("renders a short group reading on every fragment when possible", async ({ renderViewer }) => {
  const { screen } = await renderViewer({
    text: `｜${"漢".repeat(12)}《よみ》`,
    flow,
    parser: kakuyomuParser,
  });
  const readings = Array.from(
    screen.container.querySelectorAll<HTMLElement>('[data-annotation="ruby"] .kgv-ruby'),
  );

  expect(readings.map(({ textContent }) => textContent)).toEqual(["よ", "み"]);
});

test("renders the complete group reading across a suppressed gap", async ({ renderViewer }) => {
  const { screen } = await renderViewer({
    text: "[[rb:あいうえおかきくけ！　こ>よみよみよ]]",
    flow,
    parser: pixivParser,
  });
  const readings = Array.from(
    screen.container.querySelectorAll<HTMLElement>('[data-annotation="ruby"] .kgv-ruby'),
  );

  expect(readings.map(({ textContent }) => textContent)).toEqual(["よみよみ", "よ"]);
});

test("renders semantic styles from composed annotation fragments", async ({ renderViewer }) => {
  const { screen } = await renderViewer({
    text: '[b:太字][i:斜体][[emphasismark:強調>"]] ',
    flow,
    parser: pixivParser,
  });

  const bold = screen.container.querySelector<HTMLElement>('[data-annotation="bold"]');
  const italic = screen.container.querySelector<HTMLElement>('[data-annotation="italic"]');
  const emphasis = screen.container.querySelector<HTMLElement>('[data-annotation="emphasis"]');
  expect.assert(bold !== null && italic !== null && emphasis !== null);
  expect(getComputedStyle(bold).fontWeight).toBe("700");
  expect(getComputedStyle(italic).fontStyle).toBe("italic");
  expect(getComputedStyle(emphasis).textEmphasisStyle).toContain('"');
});

test("selects each diagnostic from its positioned band", async ({ renderViewer }) => {
  let selected = "";
  const { diagnostics, screen } = await renderViewer(
    { text: "「あ、。。」", flow },
    {
      onDiagnosticSelect: (diagnostic) => {
        selected = diagnostic.id;
      },
    },
  );
  const first = diagnostics.find(({ origin }) => origin.id === "kg/no-consecutive-punctuation");
  expect.assert(first !== undefined, "fixture produced no selectable diagnostic");

  await screen
    .getByRole("button", {
      name: `${first.location.start.line}行${first.location.start.column}列: ${first.message}`,
    })
    .click();

  expect(selected).toBe(first.id);
});

test("keeps partially overlapping diagnostics selectable in separate lanes", async ({
  renderViewer,
}) => {
  const selected: string[] = [];
  const { diagnostics, screen } = await renderViewer(
    { text: "「あ、。。」", flow },
    {
      onDiagnosticSelect: (diagnostic) => {
        selected.push(diagnostic.id);
      },
    },
  );
  const consecutive = diagnostics.find(
    ({ origin }) => origin.id === "kg/no-consecutive-punctuation",
  );
  const beforeClosingQuote = diagnostics.find(
    ({ origin }) => origin.id === "kg/punctuation-before-closing-quote",
  );
  expect.assert(
    consecutive !== undefined && beforeClosingQuote !== undefined,
    "fixture produced no partially overlapping diagnostics",
  );

  const consecutiveButton = screen.getByRole("button", {
    name: `${consecutive.location.start.line}行${consecutive.location.start.column}列: ${consecutive.message}`,
  });
  const beforeClosingQuoteButton = screen.getByRole("button", {
    name: `${beforeClosingQuote.location.start.line}行${beforeClosingQuote.location.start.column}列: ${beforeClosingQuote.message}`,
  });

  await consecutiveButton.click();
  await beforeClosingQuoteButton.click();

  expect(selected).toEqual([consecutive.id, beforeClosingQuote.id]);
});

test("keeps a split diagnostic as one control with continuation bands", async ({
  renderViewer,
}) => {
  const { diagnostics, screen } = await renderViewer({
    text: `${"あ".repeat(9)}２０２６`,
    flow,
  });
  const diagnostic = diagnostics.find(({ origin }) => origin.id === "kg/max-arabic-numeral-digits");
  expect.assert(diagnostic !== undefined, "fixture produced no numeral diagnostic");
  const bands = screen.container.querySelectorAll(
    `.kgv-diagnostic-band[data-diagnostic-id="${diagnostic.id}"]`,
  );

  expect(bands).toHaveLength(2);
  expect(Array.from(bands).filter(({ tagName }) => tagName === "BUTTON")).toHaveLength(1);
});

test("renders reserved lines without introducing phantom graphemes", async ({ renderViewer }) => {
  const offsets: ManuscriptOffsets = {
    document: { leading: 1, trailing: 0 },
    page: { leading: 0, trailing: 0 },
    stage: { leading: 0, trailing: 0 },
  };
  const { screen } = await renderViewer({ text: "あいう", flow, offsets });
  const lines = screen.container.querySelectorAll<HTMLElement>(".kgv-line");

  const reservedLine = lines[0];
  const contentLine = lines[1];
  expect.assert(reservedLine !== undefined, "viewer has no reserved line");
  expect.assert(contentLine !== undefined, "viewer has no content line");
  expect(reservedLine.querySelectorAll(".kgv-cell")).toHaveLength(0);
  expect(
    Array.from(contentLine.querySelectorAll(".kgv-cell"), ({ textContent }) => textContent),
  ).toEqual(["あ", "い", "う"]);
});
