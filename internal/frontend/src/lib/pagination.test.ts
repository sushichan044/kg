import { describe, expect, it } from "vite-plus/test";

import { paginate } from "./pagination";
import type { GridSettings } from "./pagination";

// A small grid keeps boundary assertions readable.
const small: GridSettings = { charsPerLine: 3, linesPerStage: 2, stagesPerPage: 1 };

// nonEmpty returns the graphemes actually placed in a line, dropping padding.
function filled(line: Array<string | null>): string[] {
  return line.filter((cell): cell is string => cell !== null);
}

describe("paginate", () => {
  it("wraps a source line after the configured character count", () => {
    const { pages } = paginate("あいうえお", small);
    // "あいうえお" (5) wraps into lines of 3 then 2, filling two lines = one stage = one page.
    expect(filled(pages[0]![0]![0]!)).toEqual(["あ", "い", "う"]);
    expect(filled(pages[0]![0]![1]!)).toEqual(["え", "お"]);
  });

  it("pads every line, stage, and page to a complete grid", () => {
    const { pages } = paginate("あ", small);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(1); // stagesPerPage
    expect(pages[0]![0]).toHaveLength(2); // linesPerStage
    expect(pages[0]![0]![0]).toEqual(["あ", null, null]); // charsPerLine
    expect(pages[0]![0]![1]).toEqual([null, null, null]); // padded empty line
  });

  it("starts each source line on a new manuscript line", () => {
    const { pages } = paginate("あ\nい", small);
    expect(filled(pages[0]![0]![0]!)).toEqual(["あ"]);
    expect(filled(pages[0]![0]![1]!)).toEqual(["い"]);
  });

  it("crosses stage and page boundaries when lines overflow", () => {
    // Four source lines, linesPerStage=2, stagesPerPage=1 => 2 stages => 2 pages.
    const { pages, stats } = paginate("a\nb\nc\nd", small);
    expect(pages).toHaveLength(2);
    expect(stats.pages).toBe(2);
    expect(filled(pages[0]![0]![0]!)).toEqual(["a"]);
    expect(filled(pages[1]![0]![0]!)).toEqual(["c"]);
  });

  it("normalizes CRLF and CR to LF", () => {
    const crlf = paginate("a\r\nb", small);
    const cr = paginate("a\rb", small);
    const lf = paginate("a\nb", small);
    expect(crlf.stats.sourceLines).toBe(2);
    expect(cr.stats.sourceLines).toBe(2);
    expect(lf.stats.sourceLines).toBe(2);
  });

  it("removes exactly one terminal newline", () => {
    expect(paginate("a\n", small).stats.sourceLines).toBe(1);
    // A second trailing newline is preserved as an internal blank line.
    expect(paginate("a\n\n", small).stats.sourceLines).toBe(2);
  });

  it("preserves internal blank lines as empty manuscript lines", () => {
    const { pages } = paginate("a\n\nb", small);
    expect(filled(pages[0]![0]![0]!)).toEqual(["a"]);
    expect(filled(pages[0]![0]![1]!)).toEqual([]); // the blank line
    expect(filled(pages[1]![0]![0]!)).toEqual(["b"]);
  });

  it("returns one blank page for an empty document", () => {
    const { pages, stats } = paginate("", small);
    expect(pages).toHaveLength(1);
    expect(stats.pages).toBe(1);
    expect(stats.chars).toBe(0);
    expect(pages[0]![0]!.every((line) => line.every((cell) => cell === null))).toBe(true);
  });

  it("places a grapheme cluster with combining marks or emoji sequences in one cell", () => {
    // Family emoji (ZWJ sequence), flag (regional indicators), variation selector.
    const { pages, stats } = paginate("👨‍👩‍👧🇯🇵⁉︎", small);
    expect(stats.chars).toBe(3);
    expect(filled(pages[0]![0]![0]!)).toEqual(["👨‍👩‍👧", "🇯🇵", "⁉︎"]);
  });

  it("counts grapheme clusters excluding newlines in statistics", () => {
    const { stats } = paginate("ab\ncd\n", small);
    expect(stats.chars).toBe(4);
    expect(stats.sourceLines).toBe(2);
  });

  it("does not apply kinsoku: closing punctuation may start a line", () => {
    // "あい、" with charsPerLine=2 wraps so "、" begins the second line untouched.
    const { pages } = paginate("あい、", { ...small, charsPerLine: 2 });
    expect(filled(pages[0]![0]![0]!)).toEqual(["あ", "い"]);
    expect(filled(pages[0]![0]![1]!)).toEqual(["、"]);
  });
});
