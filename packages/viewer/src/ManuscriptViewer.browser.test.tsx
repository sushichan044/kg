import { DEFAULT_APPEARANCE, proofreadManuscript } from "@sushichan044/kg-core";
import type { GridSettings } from "@sushichan044/kg-core";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
// Browser-mode tests use Vitest's browser runner directly.
// oxlint-disable-next-line vite-plus/prefer-vite-plus-imports
import { afterEach, beforeEach, expect, test } from "vitest";

import { ManuscriptViewer } from "./ManuscriptViewer";

import "./styles.css";

const settings: GridSettings = {
  charsPerLine: 3,
  linesPerStage: 2,
  stagesPerPage: 1,
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  host.style.width = "800px";
  host.style.height = "700px";
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  root.unmount();
  host.remove();
});

test("renders the first grapheme in the top-right cell with square geometry", () => {
  flushSync(() => {
    root.render(
      <ManuscriptViewer
        text="あいうえ"
        settings={settings}
        appearance={DEFAULT_APPEARANCE}
        zoom={{ mode: "fixed", percent: 100 }}
      />,
    );
  });

  const cells = Array.from(host.querySelectorAll<HTMLElement>(".kgv-cell"));
  const occupied = cells.filter((cell) => cell.textContent !== "");
  expect(occupied[0]?.textContent).toBe("あ");
  expect(occupied[1]?.textContent).toBe("い");
  const firstRect = cells[0]?.getBoundingClientRect();
  expect(firstRect?.width).toBeCloseTo(firstRect?.height ?? 0, 0);
  expect(cells[3]?.getBoundingClientRect().left).toBeLessThan(
    cells[0]?.getBoundingClientRect().left ?? 0,
  );
});

test("marks diagnostics and selects them without changing the manuscript", () => {
  const text = "「誤り。。。 」";
  const diagnostics = proofreadManuscript(text);
  let selected = "";
  flushSync(() => {
    root.render(
      <ManuscriptViewer
        text={text}
        settings={{ ...settings, charsPerLine: 10 }}
        diagnostics={diagnostics}
        onDiagnosticSelect={(diagnostic) => {
          selected = diagnostic.id;
        }}
      />,
    );
  });

  expect(host.querySelectorAll("[data-diagnostic]")).not.toHaveLength(0);
  const marker = host.querySelector<HTMLButtonElement>(".kgv-diagnostic-marker");
  marker?.click();
  expect(selected).toBe(diagnostics[0]?.id);
  expect(host.textContent).toContain(text);
});
