import {
  NovelCompositionSettings,
  composeManuscript,
  createDefaultProofreadingRules,
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

test("renders positioned graphemes in vertical reading order", async ({ renderViewer }) => {
  const { screen } = await renderViewer({ text: "あAい", flow });
  const cells = Array.from(screen.container.querySelectorAll<HTMLElement>(".kgv-cell"));
  expect(cells.map(({ textContent }) => textContent)).toEqual(["あ", "A", "い"]);

  const [first, latin, last] = cells.map((cell) => cell.getBoundingClientRect());
  expect.assert(first !== undefined && latin !== undefined && last !== undefined);
  expect(latin.top).toBeCloseTo(first.bottom, 1);
  expect(last.top).toBeCloseTo(latin.bottom, 1);
  expect(latin.height).toBeCloseTo(first.height / 2, 1);
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
  expect(ruby.querySelector(".kgv-ruby")?.textContent).toBe("かな");
  expect(ruby.querySelectorAll(".kgv-ruby-character")).toHaveLength(2);
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

  await screen.getByRole("button", { name: new RegExp(first.message) }).click();

  expect(selected).toBe(first.id);
});

test("keeps a split diagnostic as one control with continuation bands", async ({
  renderViewer,
}) => {
  const { diagnostics, screen } = await renderViewer({
    text: `${"あ".repeat(9)}2026`,
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

  expect(lines[0]?.querySelectorAll(".kgv-cell")).toHaveLength(0);
  expect(
    Array.from(lines[1]?.querySelectorAll(".kgv-cell") ?? [], ({ textContent }) => textContent),
  ).toEqual(["あ", "い", "う"]);
});
