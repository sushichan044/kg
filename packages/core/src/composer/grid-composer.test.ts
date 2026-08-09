import * as v from "valibot";
import { describe, expect, test } from "vite-plus/test";

import { parseManuscript } from "../parser/parse-manuscript";
import { composeManuscript } from "./compose-manuscript";
import { ManuscriptCompositionSettings } from "./composition-settings";
import { manuscriptGridComposer } from "./grid-composer";
import type { GridLine } from "./grid-line";

function settings(
  gridPatch: Partial<ManuscriptCompositionSettings["grid"]> = {},
  kinsokuPatch: Partial<ManuscriptCompositionSettings["kinsoku"]> = {},
): ManuscriptCompositionSettings {
  return {
    ...ManuscriptCompositionSettings.defaults,
    grid: {
      charsPerLine: 10,
      linesPerStage: 10,
      stagesPerPage: 1,
      ...gridPatch,
    },
    kinsoku: {
      ...ManuscriptCompositionSettings.defaults.kinsoku,
      ...kinsokuPatch,
    },
  };
}

/**
 * Every wrapped line the composer produced, in reading order, with blank padding lines dropped — a
 * padding line never holds a real cell, which a wrapped content line always does by construction
 * (kinsoku never empties a line).
 */
function wrappedLines(
  source: string,
  gridPatch: Partial<ManuscriptCompositionSettings["grid"]> = {},
  kinsokuPatch: Partial<ManuscriptCompositionSettings["kinsoku"]> = {},
): readonly GridLine[] {
  const parsed = parseManuscript(source);
  expect.assert(parsed.ok, "fixture did not parse");

  const result = composeManuscript(parsed.value, {
    composer: manuscriptGridComposer,
    settings: settings(gridPatch, kinsokuPatch),
  });
  expect.assert(result.ok, "expected composeManuscript to succeed");

  return result.value.layout.pages
    .flatMap((page) => page.stages.flatMap((stage) => stage.lines))
    .filter((line) => line.cells.some(({ value }) => value !== null));
}

function textOf(line: GridLine | undefined): string {
  expect.assert(line !== undefined, "expected a wrapped line");
  return line.cells.flatMap(({ value }) => (value === null ? [] : [value])).join("");
}

function hangingOf(line: GridLine | undefined): string {
  expect.assert(line !== undefined, "expected a wrapped line");
  return line.hanging.flatMap(({ value }) => (value === null ? [] : [value])).join("");
}

describe("manuscriptGridComposer kinsoku", () => {
  test("exiles a line-start prohibited character instead of starting a line with it", () => {
    const lines = wrappedLines("あいうえおかきくけこ」さ");

    expect(lines).toHaveLength(2);
    expect(textOf(lines[0])).toBe("あいうえおかきくけ");
    expect(textOf(lines[1])).toBe("こ」さ");
  });

  test("exiles a line-end prohibited character instead of ending a line with it", () => {
    const lines = wrappedLines("あいうえおかきくけ「さ");

    expect(lines).toHaveLength(2);
    expect(textOf(lines[0])).toBe("あいうえおかきくけ");
    expect(textOf(lines[1])).toBe("「さ");
  });

  test("hangs trailing punctuation off the line instead of starting the next line with it", () => {
    const lines = wrappedLines("あいうえおかきくけこ。さ");

    expect(lines).toHaveLength(2);
    expect(textOf(lines[0])).toBe("あいうえおかきくけこ");
    expect(hangingOf(lines[0])).toBe("。");
    expect(textOf(lines[1])).toBe("さ");
  });

  test("does not split a non-separable run across a wrap boundary", () => {
    // The pair spans the plain 10-char boundary (positions 9 and 10); both — being line-start
    // prohibited on top of non-separable — pushes one further character across too.
    const lines = wrappedLines("あいうえおかきくけ——た");

    expect(lines).toHaveLength(2);
    expect(textOf(lines[0])).toBe("あいうえおかきく");
    expect(textOf(lines[1])).toBe("け——た");
  });

  test("splits a non-separable run too long to fit on one line", () => {
    const lines = wrappedLines("…".repeat(12) + "た");

    expect(lines).toHaveLength(2);
    expect(textOf(lines[0])).toBe("…".repeat(10));
    expect(textOf(lines[1])).toBe("……た");
  });

  test("resolves a retreat that exposes a new line-end violation in a later pass", () => {
    // Exiling 」 (line-start prohibited) lands the boundary on 「 (line-end prohibited), which
    // needs a second pass to resolve.
    const lines = wrappedLines("あいうえおかきく「け」さ");

    expect(lines).toHaveLength(2);
    expect(textOf(lines[0])).toBe("あいうえおかきく");
    expect(textOf(lines[1])).toBe("「け」さ");
  });

  test("falls back from hanging to exile when the character after the hang is also prohibited", () => {
    const lines = wrappedLines("あいうえおかきくけこ。」さ");

    expect(lines).toHaveLength(2);
    expect(textOf(lines[0])).toBe("あいうえおかきくけ");
    expect(hangingOf(lines[0])).toBe("");
    expect(textOf(lines[1])).toBe("こ。」さ");
  });

  test("keeps at least one cell per line even when every candidate character is prohibited", () => {
    const lines = wrappedLines("「".repeat(15));

    for (const line of lines) {
      expect(line.cells.filter(({ value }) => value !== null).length).toBeGreaterThanOrEqual(1);
    }
    expect(lines.map((line) => textOf(line)).join("")).toBe("「".repeat(15));
  });

  test("does not apply kinsoku to a manuscript's own line end", () => {
    const lines = wrappedLines("あ「\nい");

    expect(lines).toHaveLength(2);
    expect(textOf(lines[0])).toBe("あ「");
    expect(textOf(lines[1])).toBe("い");
  });

  test("increases the page count when exile adds a wrapped line", () => {
    const source = "あ".repeat(90) + "」" + "あ".repeat(9);

    const withKinsoku = wrappedLines(source);
    const withoutKinsoku = wrappedLines(source, {}, { enabled: false });

    expect(withKinsoku).toHaveLength(11);
    expect(withoutKinsoku).toHaveLength(10);

    const parsed = parseManuscript(source);
    expect.assert(parsed.ok, "fixture did not parse");
    const composed = composeManuscript(parsed.value, {
      composer: manuscriptGridComposer,
      settings: settings(),
    });
    expect.assert(composed.ok, "expected composeManuscript to succeed");
    expect(composed.value.layout.stats.pages).toBe(2);

    const composedWithout = composeManuscript(parsed.value, {
      composer: manuscriptGridComposer,
      settings: settings({}, { enabled: false }),
    });
    expect.assert(composedWithout.ok, "expected composeManuscript to succeed");
    expect(composedWithout.value.layout.stats.pages).toBe(1);
  });

  test("falls back to a plain slice when kinsoku is disabled", () => {
    const lines = wrappedLines("あいうえおかきくけこ」さ", {}, { enabled: false });

    expect(lines).toHaveLength(2);
    expect(textOf(lines[0])).toBe("あいうえおかきくけこ");
    expect(textOf(lines[1])).toBe("」さ");
  });

  test("exiles hanging punctuation instead of hanging it when hangingPunctuation is disabled", () => {
    const lines = wrappedLines("あいうえおかきくけこ。さ", {}, { hangingPunctuation: false });

    expect(lines).toHaveLength(2);
    expect(textOf(lines[0])).toBe("あいうえおかきくけ");
    expect(hangingOf(lines[0])).toBe("");
    expect(textOf(lines[1])).toBe("こ。さ");
  });

  test("defaults kinsoku when settings omit it, for settings saved before this field existed", () => {
    // Settings loaded from storage arrive as unknown, validated through the schema — exactly how a
    // preferences payload saved before this field existed would still be accepted.
    const { kinsoku: _kinsoku, ...withoutKinsoku } = settings();

    const result = v.safeParse(ManuscriptCompositionSettings.schema, withoutKinsoku);

    expect.assert(result.success, "expected settings without kinsoku to still validate");
    expect(result.output.kinsoku).toEqual(ManuscriptCompositionSettings.defaults.kinsoku);
  });

  test("round-trips a result carrying hanging punctuation through structuredClone", () => {
    const parsed = parseManuscript("あいうえおかきくけこ。さ");
    expect.assert(parsed.ok, "fixture did not parse");

    const result = composeManuscript(parsed.value, {
      composer: manuscriptGridComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composeManuscript to succeed");
    expect(globalThis.structuredClone(result.value)).toEqual(result.value);
  });
});
