import * as v from "valibot";
import { describe, expect, test } from "vite-plus/test";

import { parseManuscript, pixivParser } from "./notation";
import {
  DEFAULT_COMPOSITION_SETTINGS,
  composeManuscript,
  manuscriptGridComposer,
} from "./pagination";
import type { ManuscriptCompositionSettings } from "./pagination";

function parsed(source: string) {
  const result = parseManuscript(source);
  if (!result.ok) throw new Error("fixture did not parse");
  return result.value;
}

function settings(
  patch: Partial<ManuscriptCompositionSettings["grid"]> = {},
): ManuscriptCompositionSettings {
  return {
    ...DEFAULT_COMPOSITION_SETTINGS,
    grid: {
      ...DEFAULT_COMPOSITION_SETTINGS.grid,
      charsPerLine: 10,
      linesPerStage: 10,
      stagesPerPage: 1,
      ...patch,
    },
  };
}

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
        ...DEFAULT_COMPOSITION_SETTINGS.offsets,
        stage: { leading: 5, trailing: 5 },
      },
    };

    expect(
      composeManuscript(parsed("本文"), { composer: manuscriptGridComposer, settings: invalid }),
    ).toMatchObject({ ok: false, errors: [{ code: "invalid-settings", stage: "compose" }] });
  });

  test("uses a custom composer supplied through the options object", () => {
    const result = composeManuscript(parsed("本文"), {
      composer: {
        id: "example/count",
        settingsSchema: v.object({ prefix: v.string() }),
        layoutSchema: v.object({ label: v.string() }),
        compose: (manuscript, value: { prefix: string }) => ({
          ok: true,
          warnings: [],
          value: { settings: value, layout: { label: value.prefix + manuscript.displayText } },
        }),
      },
      settings: { prefix: ">" },
    });

    expect(result).toMatchObject({
      ok: true,
      value: { composerId: "example/count", layout: { label: ">本文" } },
    });
  });

  test("rejects custom composer output that does not match its layout schema", () => {
    const result = composeManuscript(parsed("本文"), {
      composer: {
        id: "example/broken",
        settingsSchema: v.object({ prefix: v.string() }),
        layoutSchema: v.object({ label: v.string() }),
        compose: (_manuscript, value: { prefix: string }) => ({
          ok: true,
          warnings: [],
          value: {
            settings: value,
            layout: { label: 1 as unknown as string },
          },
        }),
      },
      settings: { prefix: ">" },
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: "invalid-composer-output", stage: "compose" }],
    });
  });
});
