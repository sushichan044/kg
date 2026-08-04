import {
  ManuscriptCompositionSettings,
  composeManuscript,
  createDefaultProofreadingRules,
  manuscriptGridComposer,
  parseManuscript,
  pixivParser,
  proofreadManuscript,
} from "@sushichan044/kg-core";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { DiagnosticList } from "./DiagnosticList";
import { ManuscriptViewer } from "./ManuscriptViewer";

import "./styles.css";

/**
 * The Tailwind Preflight rules that touch this package's DOM, left unlayered so the same fixture
 * also represents classic reset stylesheets with stronger cascade precedence.
 */
const commonReset = `
  *,
  ::before,
  ::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: 0 solid;
  }

  button {
    border-radius: 0;
    background: transparent;
    color: inherit;
    font: inherit;
  }

  ol {
    list-style: none;
  }

  strong,
  em {
    font: inherit;
  }
`;

async function renderThemedViewerUnderReset() {
  const parsed = parseManuscript("[b:太字][i:斜体]数字は2026年のまま。", {
    parser: pixivParser,
  });
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
      <style>{commonReset}</style>
      <ManuscriptViewer composed={composed.value} diagnostics={diagnostics} />
      <DiagnosticList diagnostics={diagnostics} />
    </>,
  );
  const styleOf = (selector: string) => {
    const element = screen.container.querySelector<HTMLElement>(selector);
    if (element === null) throw new Error(`missing ${selector}`);
    return getComputedStyle(element);
  };
  return { styleOf };
}

test("keeps the default manuscript theme under a common reset", async () => {
  const { styleOf } = await renderThemedViewerUnderReset();

  expect(styleOf(".kgv-page").backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(styleOf(".kgv-cell").borderBlockStartWidth).toBe("1px");
  expect(styleOf('[data-annotation="bold"]').fontWeight).toBe("700");
  expect(styleOf('[data-annotation="italic"]').fontStyle).toBe("italic");
});

test("keeps the default diagnostic theme under a common reset", async () => {
  const { styleOf } = await renderThemedViewerUnderReset();

  const button = styleOf(".kgv-diagnostics button");
  expect(button.paddingTop).not.toBe("0px");
  expect(button.borderTopWidth).toBe("1px");
  expect(button.borderRadius).toBe("3px");
  expect(button.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
});
