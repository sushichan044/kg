import { DEFAULT_APPEARANCE, proofreadManuscript } from "@sushichan044/kg-core";
import type { GridSettings, ManuscriptDiagnostic, ManuscriptOffsets } from "@sushichan044/kg-core";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";

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

test("renders a marker for a diagnostic that starts inside another diagnostic range", () => {
  const diagnostics: ManuscriptDiagnostic[] = [
    {
      id: "outer",
      ruleId: "no-consecutive-punctuation",
      message: "outer",
      severity: "error",
      range: { start: 0, end: 2 },
      location: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 2, line: 1, column: 3 },
      },
    },
    {
      id: "inner",
      ruleId: "punctuation-before-closing-quote",
      message: "inner",
      severity: "error",
      range: { start: 1, end: 2 },
      location: {
        start: { offset: 1, line: 1, column: 2 },
        end: { offset: 2, line: 1, column: 3 },
      },
    },
  ];
  const selected: string[] = [];

  flushSync(() => {
    root.render(
      <ManuscriptViewer
        text="。。"
        settings={settings}
        diagnostics={diagnostics}
        onDiagnosticSelect={(diagnostic) => {
          selected.push(diagnostic.id);
        }}
      />,
    );
  });

  const markers = host.querySelectorAll<HTMLButtonElement>(".kgv-diagnostic-marker");
  expect(markers).toHaveLength(2);
  markers[1]?.click();
  expect(selected).toEqual(["inner"]);
});

test("renders a cell whose size in pixels matches the specified point size at 100% zoom", () => {
  flushSync(() => {
    root.render(
      <ManuscriptViewer
        text="あ"
        settings={settings}
        appearance={{ ...DEFAULT_APPEARANCE, fontSizePt: 10 }}
        zoom={{ mode: "fixed", percent: 100 }}
      />,
    );
  });

  const cell = host.querySelector<HTMLElement>(".kgv-cell");
  // 10pt = 10 * (96 / 72) CSS px ≈ 13.33px.
  expect(cell?.getBoundingClientRect().width).toBeCloseTo((10 * 96) / 72, 0);
});

test("renders offset-reserved leading cells as empty", () => {
  const offsets: ManuscriptOffsets = {
    document: { leading: 1, trailing: 0 },
    page: { leading: 0, trailing: 0 },
    stage: { leading: 0, trailing: 0 },
  };

  flushSync(() => {
    root.render(
      <ManuscriptViewer
        text="あいうえ"
        settings={settings}
        appearance={DEFAULT_APPEARANCE}
        offsets={offsets}
        zoom={{ mode: "fixed", percent: 100 }}
      />,
    );
  });

  const lines = Array.from(host.querySelectorAll<HTMLElement>(".kgv-line"));
  const firstLineCells = Array.from(lines[0]?.querySelectorAll<HTMLElement>(".kgv-cell") ?? []);
  expect(firstLineCells.every((cell) => cell.textContent === "")).toBe(true);

  const secondLineCells = Array.from(lines[1]?.querySelectorAll<HTMLElement>(".kgv-cell") ?? []);
  expect(secondLineCells.map((cell) => cell.textContent)).toEqual(["あ", "い", "う"]);
});
