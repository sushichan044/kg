import { readFile } from "node:fs/promises";

import { logicalRunMeasurer } from "@sushichan044/kg-core/plugin";
import type { MeasurementRequest } from "@sushichan044/kg-core/plugin";
import * as hb from "harfbuzzjs";
import { describe, expect, test as base } from "vite-plus/test";

import { createFontMeasurer } from "./measure";
import type { FontMeasurer, FontMeasurerFaces } from "./measure";
import { measureOracle, oracleRows } from "./measure-oracle";
import { readVerticalAdvances } from "./vertical-metrics";

const asset = (file: string) => readFile(new URL(`../assets/${file}`, import.meta.url));

type Fixtures = {
  minchoFaces: FontMeasurerFaces;
  geneiFaces: FontMeasurerFaces;
  mincho: FontMeasurer;
  genei: FontMeasurer;
};

const test = base.extend<Fixtures>({
  minchoFaces: async ({}, use) => {
    await use({
      400: await asset("RinMincho-Regular.ttf"),
      700: await asset("RinMincho-Bold.ttf"),
    });
  },
  geneiFaces: async ({}, use) => {
    await use({ 400: await asset("GenEiKoburiMin6-R.ttf") });
  },
  mincho: async ({ minchoFaces }, use) => {
    const loaded = await createFontMeasurer({ fontPreset: "mincho", faces: minchoFaces });
    expect.assert(loaded.ok);
    await use(loaded.value);
  },
  genei: async ({ geneiFaces }, use) => {
    const loaded = await createFontMeasurer({ fontPreset: "genei-koburi", faces: geneiFaces });
    expect.assert(loaded.ok);
    await use(loaded.value);
  },
});

function request(
  fontPreset: "mincho" | "genei-koburi",
  text: string,
  overrides: Partial<Pick<MeasurementRequest, "style">> & {
    kind?: "base" | "ruby";
    presentation?: "mixed" | "upright";
  } = {},
): MeasurementRequest {
  const context = {
    text,
    fontPreset,
    fontSizeQ: 12.7,
    writingMode: "vertical-rl",
    ...(overrides.style === undefined ? {} : { style: overrides.style }),
  } as const;
  return overrides.kind === "ruby"
    ? { ...context, kind: "ruby", presentation: "mixed", scale: 0.5 }
    : { ...context, kind: "base", presentation: overrides.presentation ?? "mixed", scale: 1 };
}

describe("oracle", () => {
  test("matches uharfbuzz for every class, face, orientation and scale", ({ mincho, genei }) => {
    const rows = oracleRows({ mincho: mincho.measurer, "genei-koburi": genei.measurer });

    const mismatches = rows.filter(({ expected, actual }) => expected !== actual);

    expect(rows.length).toBeGreaterThan(600);
    expect(mismatches).toEqual([]);
  });
});

describe("vertical advances", () => {
  test.each(Object.entries(measureOracle.faces))(
    "reads the vmtx values that are not one em in %s",
    async (_, face) => {
      const data = await asset(face.file);
      const font = new hb.Face(new hb.Blob(data));

      const advance = readVerticalAdvances(
        font.referenceTable("vhea")?.slice(),
        font.referenceTable("vmtx")?.slice(),
      );

      expect.assert(advance !== undefined);
      expect(Object.keys(face.verticalAdvances).length).toBeGreaterThan(0);
      for (const [glyph, expected] of Object.entries(face.verticalAdvances))
        expect(advance(Number(glyph))).toBe(expected);
    },
  );

  test("measures a GenEi space and Rin long repeat marks by their vmtx", ({ mincho, genei }) => {
    const space = genei.measurer(request("genei-koburi", " ", { presentation: "upright" }));
    const repeat = mincho.measurer(request("mincho", "〱", { presentation: "upright" }));
    const mark = mincho.measurer(request("mincho", "゙", { presentation: "upright" }));

    expect(space.advanceEm).toBe(340 / 1024);
    expect(repeat.advanceEm).toBe(2);
    expect(mark.advanceEm).toBe(0);
  });
});

describe("missing glyphs", () => {
  test.for([
    ["mincho", "한"],
    ["mincho", "𠮷"],
    ["mincho", "😀"],
    ["mincho", "👍\u{1F3FD}"],
    ["genei-koburi", "😀"],
    ["genei-koburi", "〱"],
  ] as const)("measures %s %s with the logical rules", ([preset, text], { mincho, genei }) => {
    const measurer = preset === "mincho" ? mincho.measurer : genei.measurer;
    const base = request(preset, text);
    const ruby = request(preset, text, { kind: "ruby" });

    const measured = [measurer(base).advanceEm, measurer(ruby).advanceEm];

    expect(measured).toEqual([
      logicalRunMeasurer(base).advanceEm,
      logicalRunMeasurer({ ...ruby, kind: "base", presentation: "upright" }).advanceEm,
    ]);
  });

  test("falls back per grapheme inside a run", ({ mincho }) => {
    const run = request("mincho", "あ한い");

    const measured = mincho.measurer(run);

    expect(measured.advanceEm).toBe(3);
  });
});

describe("ruby", () => {
  test("measures Western ruby upright", ({ mincho }) => {
    const ruby = request("mincho", "A", { kind: "ruby" });
    const upright = request("mincho", "A", { presentation: "upright" });

    const measured = mincho.measurer(ruby);

    expect(measured.advanceEm).toBe(mincho.measurer(upright).advanceEm * 0.5);
  });
});

describe("styles", () => {
  test("uses the regular face for bold when the preset has no bold face", ({ genei }) => {
    const regular = genei.measurer(request("genei-koburi", " "));
    const bold = genei.measurer(
      request("genei-koburi", " ", { style: { weight: 700, slant: "normal" } }),
    );

    expect(bold.advanceEm).toBe(regular.advanceEm);
  });

  test("ignores the slant", ({ mincho }) => {
    const upright = mincho.measurer(request("mincho", "A"));
    const italic = mincho.measurer(
      request("mincho", "A", { style: { weight: 400, slant: "italic" } }),
    );

    expect(italic.advanceEm).toBe(upright.advanceEm);
  });
});

describe("cache", () => {
  test("keeps at most 4096 measurements", ({ mincho }) => {
    const first = request("mincho", "あ");
    const cached = mincho.measurer(first);

    const repeated = mincho.measurer(first);
    for (let codePoint = 0x4e00; codePoint < 0x4e00 + 4096; codePoint += 1)
      mincho.measurer(request("mincho", String.fromCodePoint(codePoint)));
    const evicted = mincho.measurer(first);

    expect(repeated).toBe(cached);
    expect(evicted).not.toBe(cached);
    expect(evicted).toEqual(cached);
  });
});

describe("loading", () => {
  test("rejects bytes that differ from the bundled font", async ({ minchoFaces }) => {
    const faces = { ...minchoFaces, 700: new Uint8Array([1, 2, 3]) };

    const loaded = await createFontMeasurer({ fontPreset: "mincho", faces });

    expect(loaded).toEqual({ ok: false, error: { kind: "font-integrity" } });
  });

  test("reports a missing face as a load failure", async ({ minchoFaces }) => {
    const faces = { 400: minchoFaces[400] };

    const loaded = await createFontMeasurer({ fontPreset: "mincho", faces });

    expect(loaded).toEqual({ ok: false, error: { kind: "font-load" } });
  });

  test("rejects a request for another preset", ({ mincho }) => {
    const measure = () => mincho.measurer(request("genei-koburi", "あ"));

    expect(measure).toThrow("Typography font does not match the composition settings");
  });
});
