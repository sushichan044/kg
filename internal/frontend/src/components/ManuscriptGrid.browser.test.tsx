import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
// Browser-mode tests import the runner from "vitest" directly; the
// "vite-plus/test" re-export does not resolve the browser runner.
// oxlint-disable-next-line vite-plus/prefer-vite-plus-imports
import { afterEach, beforeEach, expect, test } from "vitest";

import { paginate } from "../lib/pagination";
import type { GridSettings } from "../lib/pagination";
import { ManuscriptGrid } from "./ManuscriptGrid";

import "../styles/index.css";

const noop = () => {
  // The visible-page callback is irrelevant to these geometry checks.
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  flushSync(() => root.unmount());
  container.remove();
});

function renderGrid(text: string, settings: GridSettings): void {
  const { pages } = paginate(text, settings);
  flushSync(() => {
    root.render(<ManuscriptGrid pages={pages} restoreToPage={0} onVisiblePageChange={noop} />);
  });
}

function cellRects(): DOMRect[] {
  return [...container.querySelectorAll(".manuscript-cell")].map((c) => c.getBoundingClientRect());
}

function glyphRect(char: string): DOMRect | undefined {
  const glyph = [...container.querySelectorAll(".manuscript-glyph")].find(
    (g) => g.textContent === char,
  );

  return glyph?.getBoundingClientRect();
}

// cellRectOf returns the rect of the cell that contains the given grapheme.
function cellRectOf(char: string): DOMRect | undefined {
  const glyph = [...container.querySelectorAll(".manuscript-glyph")].find(
    (g) => g.textContent === char,
  );

  return glyph?.closest(".manuscript-cell")?.getBoundingClientRect();
}

test("every cell is square and equal in size within 0.5px", () => {
  renderGrid("あいうえお", { charsPerLine: 5, linesPerStage: 3, stagesPerPage: 1 });

  const rects = cellRects();
  expect(rects.length).toBeGreaterThan(0);

  const first = rects[0];
  expect(first).toBeDefined();
  if (!first) {
    return;
  }
  expect(Math.abs(first.width - first.height)).toBeLessThanOrEqual(0.5);
  for (const r of rects) {
    expect(Math.abs(r.width - first.width)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(r.height - first.height)).toBeLessThanOrEqual(0.5);
  }
});

test("the first grapheme occupies the top-right cell", () => {
  renderGrid("あい\nうえ", { charsPerLine: 5, linesPerStage: 3, stagesPerPage: 1 });

  const cell = cellRectOf("あ");
  expect(cell).toBeDefined();
  if (!cell) {
    return;
  }
  const rects = cellRects();
  const maxRight = Math.max(...rects.map((r) => r.right));
  const minTop = Math.min(...rects.map((r) => r.top));

  expect(cell.right).toBeCloseTo(maxRight, 0);
  expect(cell.top).toBeCloseTo(minTop, 0);
});

test("characters advance top-to-bottom and lines advance right-to-left", () => {
  renderGrid("あい\nう", { charsPerLine: 5, linesPerStage: 3, stagesPerPage: 1 });

  const a = glyphRect("あ");
  const i = glyphRect("い");
  const u = glyphRect("う");
  expect(a).toBeDefined();
  expect(i).toBeDefined();
  expect(u).toBeDefined();
  if (!a || !i || !u) {
    return;
  }

  // Within a line, the second character is below the first.
  expect(i.top).toBeGreaterThan(a.top);
  // The next source line starts to the left of the first line.
  expect(u.left).toBeLessThan(a.left);
});

test("symbols follow Unicode orientation while Latin letters and ASCII digits stay upright", () => {
  const unicodeOrientedGlyphs = [
    "‐",
    "‑",
    "‒",
    "–",
    "—",
    "―",
    "‥",
    "…",
    "-",
    "－",
    "−",
    "─",
    "あ",
    "ー",
    "〜",
    "⁉︎",
  ];
  const uprightGlyphs = ["A", "é", "é", "7"];
  renderGrid(`${unicodeOrientedGlyphs.join("")}${uprightGlyphs.join("")}`, {
    charsPerLine: 20,
    linesPerStage: 3,
    stagesPerPage: 1,
  });

  const glyphs = [...container.querySelectorAll<HTMLElement>(".manuscript-glyph")];
  for (const expected of unicodeOrientedGlyphs) {
    const glyph = glyphs.find((candidate) => candidate.textContent === expected);
    expect(glyph).toBeDefined();
    if (glyph) {
      expect(getComputedStyle(glyph).textOrientation).toBe("mixed");
    }
  }
  for (const expected of uprightGlyphs) {
    const glyph = glyphs.find((candidate) => candidate.textContent === expected);
    expect(glyph).toBeDefined();
    if (glyph) {
      expect(getComputedStyle(glyph).textOrientation).toBe("upright");
    }
  }
});
