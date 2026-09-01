import { describe, expect, test } from "vite-plus/test";

import { defaultJapaneseTypesettingProfile } from "./japanese-typesetting-profile";

describe("defaultJapaneseTypesettingProfile", () => {
  test.each([
    ["「", "mixed", "cl-01"],
    ["」", "mixed", "cl-02"],
    ["‐", "mixed", "cl-03"],
    ["？", "mixed", "cl-04"],
    ["・", "mixed", "cl-05"],
    ["。", "mixed", "cl-06"],
    ["、", "mixed", "cl-07"],
    ["…", "mixed", "cl-08"],
    ["々", "mixed", "cl-09"],
    ["ー", "mixed", "cl-10"],
    ["ょ", "mixed", "cl-11"],
    ["￥", "mixed", "cl-12"],
    ["％", "mixed", "cl-13"],
    ["　", "mixed", "cl-14"],
    ["あ", "mixed", "cl-15"],
    ["ア", "mixed", "cl-16"],
    ["漢", "mixed", "cl-19"],
    ["1", "sideways", "cl-24"],
    ["℃", "mixed", "cl-25"],
    [" ", "sideways", "cl-26"],
    ["A", "upright", "cl-27"],
    ["1", "tate-chu-yoko", "cl-30"],
  ] as const)("classifies %s (%s) as %s", (value, presentation, expected) => {
    expect(defaultJapaneseTypesettingProfile.classify({ value, presentation })).toBe(expected);
  });

  test("gives comma-side glue the highest shrink priority", () => {
    const spacing = defaultJapaneseTypesettingProfile.pairSpacing("cl-07", "cl-19");

    expect(spacing).toEqual({
      kind: "glue",
      naturalWidthEm: 0.5,
      shrink: { priority: 1, amountEm: 0.5 },
    });
  });

  test("separates a punctuation box from its following half-em glue", () => {
    expect(defaultJapaneseTypesettingProfile.boxMetrics("cl-07", 1)).toEqual({
      advanceEm: 0.5,
      renderOffsetEm: 0,
    });
    expect(defaultJapaneseTypesettingProfile.lineEndSpacing("cl-07")).toMatchObject({
      naturalWidthEm: 0.5,
    });
  });

  test.each(["cl-02", "cl-06", "cl-07"] as const)(
    "spends the invisible line-end half-em of %s before any visible space",
    (characterClass) => {
      const lineEnd = defaultJapaneseTypesettingProfile.lineEndSpacing(characterClass);
      const lineStart = defaultJapaneseTypesettingProfile.lineStartSpacing("cl-01");
      const afterComma = defaultJapaneseTypesettingProfile.pairSpacing("cl-07", "cl-19");

      expect.assert(lineEnd?.shrink !== undefined, "line end has no shrink capacity");
      expect.assert(lineStart?.shrink !== undefined, "line start has no shrink capacity");
      expect.assert(afterComma.shrink !== undefined, "comma glue has no shrink capacity");

      expect(lineEnd.shrink.priority).toBe(0);
      expect(lineEnd.shrink.priority).toBeLessThan(afterComma.shrink.priority);
      expect(lineEnd.shrink.priority).toBeLessThan(lineStart.shrink.priority);
    },
  );

  test("prohibits splitting an inseparable sequence but allows it at line start", () => {
    expect(defaultJapaneseTypesettingProfile.breakPenalty("cl-19", "cl-08")).toBe(0);
    expect(defaultJapaneseTypesettingProfile.breakPenalty("cl-08", "cl-08")).toBeNull();
    expect(defaultJapaneseTypesettingProfile.pairSpacing("cl-08", "cl-08")).toEqual({
      kind: "kern",
      naturalWidthEm: 0,
    });
  });

  test("only hangs commas and full stops", () => {
    expect(defaultJapaneseTypesettingProfile.canHang("cl-07")).toBe(true);
    expect(defaultJapaneseTypesettingProfile.canHang("cl-06")).toBe(true);
    expect(defaultJapaneseTypesettingProfile.canHang("cl-04")).toBe(false);
  });
});
