import { describe, expect, test } from "vite-plus/test";

import { FontSizeQ } from "../appearance/font-size-q";
import { PaperSize } from "../appearance/paper-size";
import { parseManuscript } from "../parser/parse-manuscript";
import { composeManuscript } from "./compose-manuscript";
import { NovelCompositionSettings } from "./composition-settings";
import { ManuscriptGeometry } from "./manuscript-geometry";
import { novelComposer } from "./novel-composer";

const a5 = NovelCompositionSettings.defaults;

function rejection(settings: NovelCompositionSettings) {
  const parsed = parseManuscript("本文");
  expect.assert(parsed.ok);

  const composed = composeManuscript(parsed.value, { composer: novelComposer, settings });

  expect.assert(!composed.ok);
  return composed.error.kind;
}

describe("physical page dimensions", () => {
  test("fills A5 with the fixed 12.7Q two-stage format and asymmetric margins", () => {
    const geometry = ManuscriptGeometry.of(a5.flow, a5.appearance, a5.page);

    expect(NovelCompositionSettings.is(a5)).toBe(true);
    expect(geometry.cellSizeMm).toBe(3.175);
    expect(geometry.contentWidthMm).toBeCloseTo(113.175, 10);
    expect(geometry.contentHeightMm).toBeCloseTo(181.45, 10);
    expect(geometry.cellSizeMm + geometry.lineGapMm).toBe(5);
    expect(geometry.stageGapMm).toBe(10);
    expect(geometry.contentHeightMm + geometry.topMm + geometry.bottomMm).toBeCloseTo(210, 10);
    expect(geometry.contentWidthMm + geometry.innerMm + geometry.outerMm).toBeCloseTo(148, 10);
  });

  test("selects the fixed A6 format and composes 697 characters per page", () => {
    const settings = NovelCompositionSettings.forPaper("a6", a5);
    const geometry = ManuscriptGeometry.of(settings.flow, settings.appearance, settings.page);
    expect(settings.flow).toEqual({ lineLengthEm: 41, linesPerStage: 17, stagesPerPage: 1 });
    expect(settings.appearance.fontSizeQ).toBe(12);
    expect(NovelCompositionSettings.is(settings)).toBe(true);
    expect(geometry.contentHeightMm).toBe(123);
    expect(geometry.contentWidthMm).toBe(83);
    const parsed = parseManuscript("あ".repeat(698));
    expect.assert(parsed.ok);
    const composed = composeManuscript(parsed.value, { composer: novelComposer, settings });
    expect.assert(composed.ok);
    expect(composed.value.layout.stats.pages).toBe(2);
    expect(rejection({ ...settings, appearance: { ...settings.appearance, fontSizeQ: 13 } })).toBe(
      "InvalidSettings",
    );
  });

  test.each(["topMm", "bottomMm", "innerMm", "outerMm", "lineGapMm", "stageGapMm"] as const)(
    "rejects inconsistent %s even when the text would fit",
    (key) => {
      expect(rejection({ ...a5, page: { ...a5.page, [key]: a5.page[key] - 0.01 } })).toBe(
        "InvalidSettings",
      );
    },
  );

  test.each(["lineLengthEm", "linesPerStage", "stagesPerPage"] as const)(
    "rejects changes to the A5 %s",
    (key) => {
      expect(rejection({ ...a5, flow: { ...a5.flow, [key]: a5.flow[key] + 1 } })).toBe(
        "InvalidSettings",
      );
    },
  );

  test("rejects another font size on A5", () => {
    expect(rejection({ ...a5, appearance: { ...a5.appearance, fontSizeQ: 13 } })).toBe(
      "InvalidSettings",
    );
  });

  test("rejects a geometrically consistent alternative to the fixed A5 format", () => {
    expect(rejection({ ...a5, page: { ...a5.page, topMm: 13, bottomMm: 15.55 } })).toBe(
      "InvalidSettings",
    );
  });

  test("centres a variable format on A4 and accepts roundoff", () => {
    const settings = NovelCompositionSettings.forPaper("a4", a5);
    const geometry = ManuscriptGeometry.of(settings.flow, settings.appearance, settings.page);

    expect(NovelCompositionSettings.is(settings)).toBe(true);
    expect(settings.page.topMm).toBe(settings.page.bottomMm);
    expect(settings.page.innerMm).toBe(settings.page.outerMm);
    expect(geometry.paperWidthMm).toBe(210);
    expect(geometry.paperHeightMm).toBe(297);
    expect(
      NovelCompositionSettings.is({
        ...settings,
        page: { ...settings.page, topMm: settings.page.topMm + 1e-7 },
      }),
    ).toBe(true);
    expect(
      rejection({ ...settings, page: { ...settings.page, topMm: settings.page.topMm + 1e-5 } }),
    ).toBe("InvalidSettings");
  });

  test("returns to the fixed A5 format without losing the typeface or reserved lines", () => {
    const custom = NovelCompositionSettings.forPaper("a4", {
      ...a5,
      flow: { lineLengthEm: 10, linesPerStage: 10, stagesPerPage: 1 },
      appearance: { ...a5.appearance, fontSizeQ: 16, fontPreset: "gothic" },
      offsets: { ...a5.offsets, document: { leading: 1, trailing: 0 } },
    });

    const restored = NovelCompositionSettings.forPaper("a5", custom);

    expect(restored.flow).toEqual(a5.flow);
    expect(restored.page).toEqual(a5.page);
    expect(restored.appearance.fontSizeQ).toBe(12.7);
    expect(restored.appearance.fontPreset).toBe("gothic");
    expect(restored.offsets.document.leading).toBe(1);
    expect(NovelCompositionSettings.is(restored)).toBe(true);
  });

  test("accepts authored millimetre gaps and asymmetric margins on a custom page", () => {
    const settings = NovelCompositionSettings.forPaper("a4", a5);
    const page = {
      ...settings.page,
      lineGapMm: 2,
      stageGapMm: 10,
      topMm: 12,
      bottomMm: 103.55,
      innerMm: 30,
      outerMm: 62.975,
    };
    const geometry = ManuscriptGeometry.of(settings.flow, settings.appearance, page);

    expect(NovelCompositionSettings.is({ ...settings, page })).toBe(true);
    expect(geometry.stageGapMm).toBe(10);
    expect(geometry.lineGapMm).toBe(2);
    expect(geometry.topMm).toBe(12);
  });

  test("rejects gaps too narrow for the existing half-size ruby area", () => {
    const settings = NovelCompositionSettings.forPaper("a4", a5);
    const page = {
      ...settings.page,
      lineGapMm: 1,
      outerMm: settings.page.outerMm + (settings.page.lineGapMm - 1) * 22,
    };

    expect(rejection({ ...settings, page })).toBe("InvalidSettings");
  });

  test("rejects an oversized custom grid rather than clamping or shrinking it", () => {
    expect(rejection(NovelCompositionSettings.forPaper("shinsho", a5))).toBe("InvalidSettings");
  });

  test.each([
    ["a6", "A6（文庫）", 105, 148],
    ["shinsho", "新書", 106, 173],
  ] as const)("keeps the %s paper format", (id, label, widthMm, heightMm) => {
    expect(PaperSize.of(id)).toEqual({ id, label, widthMm, heightMm });
  });
});

test("accepts positive finite Q sizes and rejects invalid sizes", () => {
  expect(FontSizeQ.is(12.7)).toBe(true);
  expect(FontSizeQ.is(13)).toBe(true);
  for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "12.7"]) {
    expect(FontSizeQ.is(value)).toBe(false);
  }
});
