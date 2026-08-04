import {
  ManuscriptCompositionSettings,
  composeManuscript,
  createDefaultProofreadingRules,
  manuscriptGridComposer,
  parseManuscript,
  pixivParser,
  proofreadManuscript,
} from "@sushichan044/kg-core";
import type { ManuscriptParser } from "@sushichan044/kg-core";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { DiagnosticList } from "./DiagnosticList";
import { ManuscriptViewer } from "./ManuscriptViewer";

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
  if (!parsed.ok) throw new Error("fixture did not parse");
  const composed = composeManuscript(parsed.value, {
    composer: manuscriptGridComposer,
    settings: ManuscriptCompositionSettings.defaults,
  });
  if (!composed.ok) throw new Error("fixture did not compose");
  const proofread = proofreadManuscript(composed.value, {
    rules: createDefaultProofreadingRules(),
  });
  if (!proofread.ok) throw new Error("fixture did not proofread");
  const diagnostics = [...parsed.warnings, ...proofread.value];
  if (diagnostics.length === 0) throw new Error("fixture produced no diagnostics");

  const screen = await render(
    <>
      <style>{hostStyles}</style>
      <ManuscriptViewer composed={composed.value} diagnostics={diagnostics} />
      <DiagnosticList diagnostics={diagnostics} />
    </>,
  );
  const query = <T extends HTMLElement>(selector: string) => {
    const element = screen.container.querySelector<T>(selector);
    if (element === null) throw new Error(`missing ${selector}`);
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

test("keeps the diagnostic marker an invisible overlay under host button styles", async () => {
  const { styleOf } = await renderWithHostStyles("数字は2026年のまま。");

  const marker = styleOf(".kgv-diagnostic-marker");
  expect(marker.position).toBe("absolute");
  expect(marker.borderTopWidth).toBe("0px");
  expect(marker.paddingTop).toBe("0px");
  expect(marker.backgroundColor).toBe("rgba(0, 0, 0, 0)");
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
