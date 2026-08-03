import { describe, expect, test } from "vite-plus/test";

import { pixivNotation, plainTextNotation } from "./notation";
import { DEFAULT_OFFSETS, MAX_DOCUMENT_OFFSET, paginateManuscript } from "./pagination";
import type { GridSettings, Line, ManuscriptOffsets } from "./pagination";

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

  test("paginates displayed pixiv text while retaining raw ranges and annotations", () => {
    const source = "[[rb:漢字>かんじ]][b:太字]";
    const { pages, stats } = paginateManuscript(source, small, DEFAULT_OFFSETS, pixivNotation);
    const firstLine = pages[0]![0]![0]!;
    const secondLine = pages[0]![0]![1]!;

    expect(stats.chars).toBe(4);
    expect(filled(firstLine)).toEqual(["漢", "字", "太"]);
    expect(filled(secondLine)).toEqual(["字"]);
    expect(firstLine[0]).toMatchObject({
      sourceRange: { start: 5, end: 6 },
      annotations: [{ kind: "ruby", reading: "かんじ" }],
    });
    expect(firstLine[2]).toMatchObject({
      sourceRange: { start: source.indexOf("太"), end: source.indexOf("太") + 1 },
      annotations: [{ kind: "bold" }],
    });
    expect(secondLine[0]).toMatchObject({ annotations: [{ kind: "bold" }] });
    expect(firstLine[2]?.annotations?.[0]).toBe(secondLine[0]?.annotations?.[0]);
  });

  test("preserves displayed blank lines and raw offsets with pixiv notation", () => {
    const source = "[b:あ]\r\n\r\n[i:い]";
    const { pages, stats } = paginateManuscript(source, small, DEFAULT_OFFSETS, pixivNotation);

    expect(stats.sourceLines).toBe(3);
    expect(filled(pages[0]![0]![0]!)).toEqual(["あ"]);
    expect(filled(pages[0]![0]![1]!)).toEqual([]);
    expect(pages[1]![0]![0]![0]).toMatchObject({
      grapheme: "い",
      sourceRange: { start: source.indexOf("い"), end: source.indexOf("い") + 1 },
    });
  });
});

describe("paginateManuscript with offsets", () => {
  test("reserves N leading document lines before the first body line", () => {
    const settings: GridSettings = { charsPerLine: 3, linesPerStage: 6, stagesPerPage: 1 };
    const offsets: ManuscriptOffsets = {
      ...DEFAULT_OFFSETS,
      document: { leading: 2, trailing: 0 },
    };
    const { pages } = paginateManuscript("あいうえお", settings, offsets);
    const stage = pages[0]![0]!;

    expect(filled(stage[0]!)).toEqual([]);
    expect(filled(stage[1]!)).toEqual([]);
    expect(filled(stage[2]!)).toEqual(["あ", "い", "う"]);
    expect(filled(stage[3]!)).toEqual(["え", "お"]);
    expect(filled(stage[4]!)).toEqual([]);
    expect(filled(stage[5]!)).toEqual([]);
  });

  test("reserves a trailing document line after the last body line", () => {
    const settings: GridSettings = { charsPerLine: 3, linesPerStage: 4, stagesPerPage: 1 };
    const offsets: ManuscriptOffsets = {
      ...DEFAULT_OFFSETS,
      document: { leading: 0, trailing: 1 },
    };
    const { pages } = paginateManuscript("あい", settings, offsets);
    const stage = pages[0]![0]!;

    expect(filled(stage[0]!)).toEqual(["あ", "い"]);
    expect(filled(stage[1]!)).toEqual([]);
  });

  test("reserves stage-level leading and trailing lines at each stage boundary", () => {
    const settings: GridSettings = { charsPerLine: 3, linesPerStage: 6, stagesPerPage: 1 };
    const offsets: ManuscriptOffsets = { ...DEFAULT_OFFSETS, stage: { leading: 1, trailing: 1 } };
    const { pages } = paginateManuscript("あ\nい\nう\nえ", settings, offsets);
    const stage = pages[0]![0]!;

    expect(filled(stage[0]!)).toEqual([]);
    expect(filled(stage[1]!)).toEqual(["あ"]);
    expect(filled(stage[2]!)).toEqual(["い"]);
    expect(filled(stage[3]!)).toEqual(["う"]);
    expect(filled(stage[4]!)).toEqual(["え"]);
    expect(filled(stage[5]!)).toEqual([]);
  });

  test("reserves page-level leading and trailing lines across the page's stages without double counting", () => {
    const settings: GridSettings = { charsPerLine: 3, linesPerStage: 4, stagesPerPage: 2 };
    const offsets: ManuscriptOffsets = { ...DEFAULT_OFFSETS, page: { leading: 1, trailing: 1 } };
    const { pages } = paginateManuscript("あ\nい\nう\nえ\nお\nか", settings, offsets);
    const [stage0, stage1] = pages[0]!;

    expect(filled(stage0![0]!)).toEqual([]);
    expect(filled(stage0![1]!)).toEqual(["あ"]);
    expect(filled(stage0![2]!)).toEqual(["い"]);
    expect(filled(stage0![3]!)).toEqual(["う"]);
    expect(filled(stage1![0]!)).toEqual(["え"]);
    expect(filled(stage1![1]!)).toEqual(["お"]);
    expect(filled(stage1![2]!)).toEqual(["か"]);
    expect(filled(stage1![3]!)).toEqual([]);
  });

  test("combines document, stage, and page offsets without double-counting reserved lines", () => {
    const settings: GridSettings = { charsPerLine: 3, linesPerStage: 6, stagesPerPage: 2 };
    const offsets: ManuscriptOffsets = {
      document: { leading: 1, trailing: 1 },
      stage: { leading: 1, trailing: 1 },
      page: { leading: 1, trailing: 1 },
    };
    const { pages } = paginateManuscript("あ\nい\nう\nえ", settings, offsets);
    expect(pages).toHaveLength(1);
    const [stage0, stage1] = pages[0]!;

    // Stage boundaries stay reserved regardless of the page- and document-level offsets.
    expect(filled(stage0![0]!)).toEqual([]);
    expect(filled(stage0![5]!)).toEqual([]);
    expect(filled(stage1![0]!)).toEqual([]);
    expect(filled(stage1![5]!)).toEqual([]);

    // All four source lines appear exactly once, in order: nothing is dropped or duplicated.
    const bodyContent = [
      stage0![1]!,
      stage0![2]!,
      stage0![3]!,
      stage0![4]!,
      stage1![1]!,
      stage1![2]!,
      stage1![3]!,
      stage1![4]!,
    ].flatMap((line) => filled(line));
    expect(bodyContent).toEqual(["あ", "い", "う", "え"]);
  });

  test("clamps a pathologically large offset and still produces a finite number of pages", () => {
    const settings: GridSettings = { charsPerLine: 3, linesPerStage: 2, stagesPerPage: 1 };
    const offsets: ManuscriptOffsets = {
      document: { leading: 0, trailing: 0 },
      stage: { leading: 1000, trailing: 1000 },
      page: { leading: 1000, trailing: 1000 },
    };
    const { pages, stats } = paginateManuscript("あいうえおかきくけこ", settings, offsets);

    expect(pages).toHaveLength(4);
    expect(Number.isFinite(pages.length)).toBe(true);
    expect(stats.pages).toBe(pages.length);
  });

  test("clamps a pathologically large document offset to MAX_DOCUMENT_OFFSET without throwing", () => {
    const settings: GridSettings = { charsPerLine: 3, linesPerStage: 2, stagesPerPage: 1 };
    const offsets: ManuscriptOffsets = {
      document: { leading: Number.MAX_SAFE_INTEGER, trailing: 4_294_967_296 },
      stage: { leading: 0, trailing: 0 },
      page: { leading: 0, trailing: 0 },
    };

    expect(() => paginateManuscript("あいうえおかきくけこ", settings, offsets)).not.toThrow();

    const { pages, stats } = paginateManuscript("あいうえおかきくけこ", settings, offsets);
    expect(Number.isFinite(pages.length)).toBe(true);
    expect(stats.pages).toBe(pages.length);
    // The resolved document offset is bounded by MAX_DOCUMENT_OFFSET lines on each side, plus
    // the 10 characters of body content wrapped into 4 lines at charsPerLine 3.
    const expectedTotalLines = MAX_DOCUMENT_OFFSET + 4 + MAX_DOCUMENT_OFFSET;
    const expectedPages = Math.ceil(expectedTotalLines / settings.linesPerStage);
    expect(pages).toHaveLength(expectedPages);
  });

  test("keeps existing default-offset behavior unchanged when offsets are omitted", () => {
    const withDefault = paginateManuscript("あいうえお", small);
    const withExplicitDefault = paginateManuscript("あいうえお", small, DEFAULT_OFFSETS);
    expect(withDefault).toEqual(withExplicitDefault);
  });

  test("keeps plain text pagination identical when the default notation is explicit", () => {
    const implicit = paginateManuscript("あ\r\n😀", small);
    const explicit = paginateManuscript("あ\r\n😀", small, DEFAULT_OFFSETS, plainTextNotation);

    expect(implicit).toEqual(explicit);
  });
});
