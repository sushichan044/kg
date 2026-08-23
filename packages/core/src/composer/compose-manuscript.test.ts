import * as v from "valibot";
import { describe, expect, test } from "vite-plus/test";

import { parseManuscript } from "../parser/parse-manuscript";
import { pixivParser } from "../parser/pixiv-parser";
import { ManuscriptResult } from "../result/manuscript-result";
import { composeManuscript } from "./compose-manuscript";
import { ManuscriptCompositionSettings } from "./composition-settings";
import { manuscriptGridComposer } from "./grid-composer";
import type { ManuscriptComposer } from "./manuscript-composer";

function parsed(source: string) {
  const result = parseManuscript(source);
  expect.assert(result.ok, "fixture did not parse");

  return result.value;
}

function settings(
  patch: Partial<ManuscriptCompositionSettings["grid"]> = {},
): ManuscriptCompositionSettings {
  return {
    ...ManuscriptCompositionSettings.defaults,
    grid: {
      charsPerLine: 10,
      linesPerStage: 10,
      stagesPerPage: 1,
      ...patch,
    },
  };
}

function occupiedText(line: { cells: ReadonlyArray<{ value: string | null }> }): string {
  return line.cells.flatMap(({ value }) => (value === null ? [] : [value])).join("");
}

type LabelLayout = { label: string };

/**
 * A minimal third-party composer: enough to exercise the plugin boundary, nothing more.
 */
const labelComposer = (
  id: string,
  label: (prefix: string, displayText: string) => LabelLayout,
): ManuscriptComposer<{ prefix: string }, LabelLayout> => ({
  id,
  settingsSchema: v.object({ prefix: v.string() }),
  layoutSchema: v.object({ label: v.string() }),
  compose: (manuscript, value) =>
    ManuscriptResult.succeed(label(value.prefix, manuscript.displayText)),
});

/**
 * Stands in for a JavaScript plugin whose runtime output contradicts its declared schema — the one
 * thing the layout schema exists to catch, and unreachable without lying to the compiler.
 */
const lyingLabel = (): LabelLayout => ({ label: 1 }) as unknown as LabelLayout;

describe("composeManuscript", () => {
  test("returns a self-contained grid snapshot with ranges at every level", () => {
    const source = "あいうえおかきくけこさし";
    const result = composeManuscript(parsed(source), {
      composer: manuscriptGridComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composeManuscript to succeed");
    expect(result.value.composerId).toBe("kg/grid");
    expect(result.value.settings).toEqual(settings());
    expect(result.value.parsed.source).toBe(source);

    const page = result.value.layout.pages[0];
    expect.assert(page !== undefined, "grid layout has no first page");
    expect.assert(page.range !== null, "first page has no range");
    expect(page.range.source).toEqual({ start: 0, end: 12 });

    const stage = page.stages[0];
    expect.assert(stage !== undefined, "first page has no first stage");
    expect.assert(stage.range !== null, "first stage has no range");
    expect(stage.range.graphemes).toEqual({ start: 0, end: 12 });

    const line = stage.lines[1];
    expect.assert(line !== undefined, "first stage has no second line");

    const firstCell = line.cells[0];
    expect.assert(firstCell !== undefined, "second line has no first cell");
    expect(firstCell).toMatchObject({
      value: "さ",
      range: {
        source: { start: 10, end: 11 },
        display: { start: 10, end: 11 },
        graphemes: { start: 10, end: 11 },
      },
    });

    const thirdCell = line.cells[2];
    expect.assert(thirdCell !== undefined, "second line has no third cell");
    expect(thirdCell.range).toBeNull();
    expect(globalThis.structuredClone(result.value)).toEqual(result.value);
  });

  test("composes displayed Pixiv text while preserving annotations", () => {
    const parseResult = parseManuscript("[b:太字]", { parser: pixivParser });
    expect.assert(parseResult.ok, "fixture did not parse");

    const result = composeManuscript(parseResult.value, {
      composer: manuscriptGridComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composeManuscript to succeed");

    const firstCell = result.value.layout.pages[0]?.stages[0]?.lines[0]?.cells[0];
    expect.assert(firstCell !== undefined, "grid layout has no first cell");
    expect(firstCell).toMatchObject({
      value: "太",
      annotations: [{ kind: "bold" }],
    });
  });

  test("omits a valid gap after question or exclamation marks at a wrap boundary", () => {
    const source = "あいうえおかきく！？　続き";
    const result = composeManuscript(parsed(source), {
      composer: manuscriptGridComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composeManuscript to succeed");

    const page = result.value.layout.pages[0];
    expect.assert(page !== undefined, "grid layout has no first page");
    const stage = page.stages[0];
    expect.assert(stage !== undefined, "grid layout has no first stage");
    const firstLine = stage.lines[0];
    const secondLine = stage.lines[1];
    expect.assert(firstLine !== undefined, "grid layout has no first line");
    expect.assert(secondLine !== undefined, "grid layout has no second line");

    expect(occupiedText(firstLine)).toBe("あいうえおかきく！？");
    expect(occupiedText(secondLine)).toBe("続き");
    expect(secondLine.cells[0]).toMatchObject({
      value: "続",
      range: { source: { start: 11, end: 12 } },
    });
    expect(result.value.parsed.source).toBe(source);
    expect(result.value.layout.stats.chars).toBe(13);
  });

  test.each([
    ["a gap within a grid line", "あ！　続き", "あ！　続き"],
    ["two gaps rejected by proofreading", "あいうえおかきくけ！　　続き", "　　続き"],
    ["a gap before a closing bracket", "あいうえおかきくけ！　」", "　」"],
  ])("preserves %s", (_case, source, expectedLine) => {
    const result = composeManuscript(parsed(source), {
      composer: manuscriptGridComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composeManuscript to succeed");

    const page = result.value.layout.pages[0];
    expect.assert(page !== undefined, "grid layout has no first page");
    const stage = page.stages[0];
    expect.assert(stage !== undefined, "grid layout has no first stage");
    const lineIndex = source.length > 10 ? 1 : 0;
    const line = stage.lines[lineIndex];
    expect.assert(line !== undefined, "grid layout has no expected line");

    expect(occupiedText(line)).toBe(expectedLine);
  });

  test("preserves indentation after a source line break", () => {
    const result = composeManuscript(parsed("あいうえおかきくけ！\n　続き"), {
      composer: manuscriptGridComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composeManuscript to succeed");

    const page = result.value.layout.pages[0];
    expect.assert(page !== undefined, "grid layout has no first page");
    const stage = page.stages[0];
    expect.assert(stage !== undefined, "grid layout has no first stage");
    const secondLine = stage.lines[1];
    expect.assert(secondLine !== undefined, "grid layout has no second line");

    expect(occupiedText(secondLine)).toBe("　続き");
  });

  test("returns a composition failure instead of clamping unusable offsets", () => {
    const invalid: ManuscriptCompositionSettings = {
      ...settings(),
      offsets: {
        ...ManuscriptCompositionSettings.defaults.offsets,
        stage: { leading: 5, trailing: 5 },
      },
    };

    const result = composeManuscript(parsed("本文"), {
      composer: manuscriptGridComposer,
      settings: invalid,
    });

    expect.assert(result.ok === false, "expected composeManuscript to report a failure");
    expect(result.error).toMatchObject({ kind: "InvalidSettings", composerId: "kg/grid" });
  });

  test("uses a custom composer supplied through the options object", () => {
    const result = composeManuscript(parsed("本文"), {
      composer: labelComposer("example/count", (prefix, displayText) => ({
        label: prefix + displayText,
      })),
      settings: { prefix: ">" },
    });

    expect(result).toMatchObject({
      ok: true,
      value: { composerId: "example/count", layout: { label: ">本文" } },
    });
  });

  test("rejects custom composer output that does not match its layout schema", () => {
    const result = composeManuscript(parsed("本文"), {
      composer: labelComposer("example/broken", lyingLabel),
      settings: { prefix: ">" },
    });

    expect.assert(result.ok === false, "expected composeManuscript to report a failure");
    expect(result.error).toMatchObject({
      kind: "InvalidComposerOutput",
      composerId: "example/broken",
    });
  });

  test("reports the offending ID when a composer is not namespaced", () => {
    const result = composeManuscript(parsed("本文"), {
      composer: labelComposer("broken", (prefix) => ({ label: prefix })),
      settings: { prefix: ">" },
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: "InvalidComposerId", composerId: "broken" },
    });
  });
});
