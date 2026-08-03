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
  if (!result.ok) throw new Error("fixture did not parse");
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

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.composerId).toBe("kg/grid");
    expect(result.value.settings).toEqual(settings());
    expect(result.value.parsed.source).toBe(source);
    const page = result.value.layout.pages[0]!;
    expect(page.range?.source).toEqual({ start: 0, end: 12 });
    expect(page.stages[0]?.range?.graphemes).toEqual({ start: 0, end: 12 });
    expect(page.stages[0]?.lines[1]?.cells[0]).toMatchObject({
      value: "さ",
      range: {
        source: { start: 10, end: 11 },
        display: { start: 10, end: 11 },
        graphemes: { start: 10, end: 11 },
      },
    });
    expect(page.stages[0]?.lines[1]?.cells[2]?.range).toBeNull();
    expect(globalThis.structuredClone(result.value)).toEqual(result.value);
  });

  test("composes displayed Pixiv text while preserving annotations", () => {
    const parseResult = parseManuscript("[b:太字]", { parser: pixivParser });
    if (!parseResult.ok) throw new Error("fixture did not parse");
    const result = composeManuscript(parseResult.value, {
      composer: manuscriptGridComposer,
      settings: settings(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.layout.pages[0]?.stages[0]?.lines[0]?.cells[0]).toMatchObject({
      value: "太",
      annotations: [{ kind: "bold" }],
    });
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

    expect(result.ok).toBe(false);
    if (result.ok) return;
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

    expect(result.ok).toBe(false);
    if (result.ok) return;
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
