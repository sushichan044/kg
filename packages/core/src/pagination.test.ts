import { describe, expect, test } from "vite-plus/test";

import { paginateManuscript } from "./pagination";
import type { GridSettings, Line } from "./pagination";

const small: GridSettings = { charsPerLine: 3, linesPerStage: 2, stagesPerPage: 1 };

function filled(line: Line): string[] {
  return line.flatMap((cell) => (cell === null ? [] : [cell.grapheme]));
}

describe("paginateManuscript", () => {
  test("wraps source lines and maps occupied cells to source ranges", () => {
    const { pages } = paginateManuscript("あいうえお", small);
    expect(filled(pages[0]![0]![0]!)).toEqual(["あ", "い", "う"]);
    expect(filled(pages[0]![0]![1]!)).toEqual(["え", "お"]);
    expect(pages[0]![0]![1]![0]).toEqual({
      grapheme: "え",
      sourceRange: { start: 3, end: 4 },
    });
  });

  test("preserves raw offsets while normalizing CRLF and CR boundaries", () => {
    const crlf = paginateManuscript("a\r\nb", small);
    const cr = paginateManuscript("a\rb", small);
    expect(crlf.pages[0]![0]![1]![0]).toEqual({
      grapheme: "b",
      sourceRange: { start: 3, end: 4 },
    });
    expect(cr.pages[0]![0]![1]![0]).toEqual({
      grapheme: "b",
      sourceRange: { start: 2, end: 3 },
    });
  });

  test("removes exactly one terminal newline and preserves internal blank lines", () => {
    expect(paginateManuscript("a\n", small).stats.sourceLines).toBe(1);
    expect(paginateManuscript("a\n\n", small).stats.sourceLines).toBe(2);
    const { pages } = paginateManuscript("a\n\nb", small);
    expect(filled(pages[0]![0]![1]!)).toEqual([]);
    expect(filled(pages[1]![0]![0]!)).toEqual(["b"]);
  });

  test("returns one blank page for an empty document", () => {
    const { pages, stats } = paginateManuscript("", small);
    expect(stats).toEqual({ chars: 0, sourceLines: 1, pages: 1 });
    expect(pages[0]![0]!.every((line) => line.every((cell) => cell === null))).toBe(true);
  });

  test("keeps grapheme clusters in one cell with their full source ranges", () => {
    const { pages, stats } = paginateManuscript("👨‍👩‍👧🇯🇵⁉︎", small);
    expect(stats.chars).toBe(3);
    expect(filled(pages[0]![0]![0]!)).toEqual(["👨‍👩‍👧", "🇯🇵", "⁉︎"]);
    expect(pages[0]![0]![0]![0]?.sourceRange).toEqual({ start: 0, end: "👨‍👩‍👧".length });
  });

  test("does not apply line-breaking correction", () => {
    const { pages } = paginateManuscript("あい、", { ...small, charsPerLine: 2 });
    expect(filled(pages[0]![0]![0]!)).toEqual(["あ", "い"]);
    expect(filled(pages[0]![0]![1]!)).toEqual(["、"]);
  });
});
