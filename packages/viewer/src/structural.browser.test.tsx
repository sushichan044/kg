import {
  NovelCompositionSettings,
  composeManuscript,
  novelComposer,
  parseManuscript,
  pixivParser,
} from "@sushichan044/kg-core";
import { createDefaultProofreadingRules, proofreadManuscript } from "@sushichan044/kg-core/lint";
import type { ManuscriptParser } from "@sushichan044/kg-core/plugin";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { DiagnosticList } from "./DiagnosticList";
import { NovelViewer } from "./NovelViewer";

import "./structural.css";

/**
 * Rules a plain-CSS application is likely to ship, written the way such applications write them:
 * bare element selectors and a universal reset, loaded after the viewer's own stylesheet. The grid
 * has to survive exactly this in the host document.
 */
const hostStyles = `
  *,
  ::before,
  ::after {
    box-sizing: content-box;
    margin: 0;
    padding: 0;
    border: 0;
  }

  body {
    letter-spacing: 0.5em;
    text-transform: uppercase;
  }

  button {
    position: static;
    padding: 0.5rem;
    border: 1px solid #333;
    background: #eee;
  }

  ol {
    padding-inline-start: 40px;
    list-style: disc;
  }

  p {
    margin-block: 1em;
  }

  strong,
  em {
    font: inherit;
  }
`;

async function renderWithHostStyles(text: string, parser?: ManuscriptParser) {
  const parsed = parseManuscript(text, { parser });
  expect.assert(parsed.ok, "fixture did not parse");

  const composed = composeManuscript(parsed.value, {
    composer: novelComposer,
    settings: NovelCompositionSettings.defaults,
  });
  expect.assert(composed.ok, "fixture did not compose");

  const proofread = proofreadManuscript(composed.value, {
    rules: createDefaultProofreadingRules(),
  });
  expect.assert(proofread.ok, "fixture did not proofread");

  const diagnostics = [...parsed.warnings, ...proofread.value];
  expect.assert(diagnostics.length > 0, "fixture produced no diagnostics");

  const screen = await render(
    <>
      <style>{hostStyles}</style>
      <NovelViewer composed={composed.value} diagnostics={diagnostics} />
      <DiagnosticList diagnostics={diagnostics} />
    </>,
  );
  const query = <T extends HTMLElement>(selector: string) => {
    const element = screen.container.querySelector<T>(selector);
    expect.assert(element !== null, `missing ${selector}`);

    return element;
  };
  return { query, styleOf: (selector: string) => getComputedStyle(query(selector)) };
}

test("keeps sized boxes on border-box when the host resets box-sizing", async () => {
  const { styleOf } = await renderWithHostStyles("数字は2026年のまま。");

  expect(styleOf(".kgv-viewer").boxSizing).toBe("border-box");
  expect(styleOf(".kgv-viewport").boxSizing).toBe("border-box");
  expect(styleOf(".kgv-page").boxSizing).toBe("border-box");
  expect(styleOf(".kgv-cell").boxSizing).toBe("border-box");
  expect(styleOf(".kgv-diagnostic-band").boxSizing).toBe("border-box");
  expect(styleOf(".kgv-diagnostics button").boxSizing).toBe("border-box");
});

test("keeps semantic annotation styles when the host resets fonts", async () => {
  const { styleOf } = await renderWithHostStyles(
    "[b:太字][i:斜体]数字は2026年のまま。",
    pixivParser,
  );

  expect(styleOf('[data-annotation="bold"]').fontWeight).toBe("700");
  expect(styleOf('[data-annotation="italic"]').fontStyle).toBe("italic");
});

test("keeps the diagnostic band an unpainted overlay under host button styles", async () => {
  const { styleOf } = await renderWithHostStyles("数字は2026年のまま。");

  const band = styleOf("button.kgv-diagnostic-band");
  expect(band.position).toBe("absolute");
  expect(band.borderTopWidth).toBe("0px");
  expect(band.paddingTop).toBe("0px");
  expect(band.backgroundColor).toBe("rgba(0, 0, 0, 0)");
});

test("rules the nominal em pitch behind positioned text", async () => {
  const { query } = await renderWithHostStyles("数字は2026年のまま。");

  const line = query(".kgv-line");
  const cells = Array.from(line.querySelectorAll<HTMLElement>(".kgv-cell"));
  const rules = Array.from(line.querySelectorAll<HTMLElement>(".kgv-rule-cell"));
  const pitchProbe = document.createElement("span");
  pitchProbe.style.position = "absolute";
  pitchProbe.style.blockSize = "var(--kgv-cell-size)";
  line.append(pitchProbe);
  const nominalPitch = pitchProbe.getBoundingClientRect().height;
  pitchProbe.remove();

  expect(rules.length).toBeGreaterThanOrEqual(cells.length);
  // Cell and rule indexes diverge once the half-width digits begin.
  for (const [index, cell] of cells.slice(0, 2).entries()) {
    const rule = rules[index];
    expect.assert(rule !== undefined, `line has no rule at index ${index}`);

    const ruled = rule.getBoundingClientRect();
    const written = cell.getBoundingClientRect();
    expect(ruled.top).toBeCloseTo(written.top, 1);
    expect(ruled.height).toBeCloseTo(nominalPitch, 1);
  }
});

test("keeps the decoration layers out of the line they cover", async () => {
  const { query } = await renderWithHostStyles("数字は2026年のまま。");

  const line = query(".kgv-line").getBoundingClientRect();
  const rules = query(".kgv-line-rules").getBoundingClientRect();
  const diagnostics = query(".kgv-line-diagnostics").getBoundingClientRect();

  for (const layer of [rules, diagnostics]) {
    expect(layer.top).toBeCloseTo(line.top, 1);
    expect(layer.left).toBeCloseTo(line.left, 1);
    expect(layer.width).toBeCloseTo(line.width, 1);
    expect(layer.height).toBeCloseTo(line.height, 1);
  }
});

test("keeps glyphs centred when the host sets inherited text properties", async () => {
  const { query, styleOf } = await renderWithHostStyles("Aあ2026。");

  expect(styleOf(".kgv-glyph").letterSpacing).toBe("normal");
  expect(styleOf(".kgv-glyph").textTransform).toBe("none");
  expect(query(".kgv-glyph").textContent).toBe("A");
  const cell = query(".kgv-cell").getBoundingClientRect();
  const glyph = query(".kgv-glyph").getBoundingClientRect();
  expect(glyph.right).toBeLessThanOrEqual(cell.right + 0.5);
});

test("keeps the diagnostic list unbulleted under a host list reset", async () => {
  const { styleOf } = await renderWithHostStyles("数字は2026年のまま。");

  const list = styleOf(".kgv-diagnostics");
  expect(list.listStyleType).toBe("none");
  expect(list.paddingInlineStart).toBe("0px");
});

test("keeps the assistive page text out of the layout under a host paragraph reset", async () => {
  const { styleOf } = await renderWithHostStyles("数字は2026年のまま。");

  const hidden = styleOf(".kgv-visually-hidden");
  expect(hidden.position).toBe("absolute");
  expect(hidden.marginTop).toBe("-1px");
});
