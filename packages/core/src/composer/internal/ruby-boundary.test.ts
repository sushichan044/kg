import { describe, expect, test } from "vite-plus/test";

import type { JapaneseCharacterClass } from "./japanese-typesetting-rules";
import { RubyBoundary } from "./ruby-boundary";

describe("JLReq 3.3.8 ruby boundaries", () => {
  test.each([
    ["cl-15", "before", 0, 0.5],
    ["cl-16", "after", 0, 0.5],
    ["cl-10", "after", 0, 0.5],
    ["cl-11", "before", 0, 0.5],
    ["cl-08", "after", 0, 0.5],
    ["cl-19", "before", 0.5, 0],
    ["cl-02", "before", 0.5, 0.5],
    ["cl-02", "before", 0.125, 0.125],
    ["cl-06", "after", 0.5, 0.5],
    ["cl-07", "before", 0, 0],
    ["cl-01", "after", 0.25, 0.25],
    ["cl-01", "before", 0, 0.5],
    ["cl-05", "before", 0.25, 0.5],
    ["cl-05", "after", 0, 0.25],
  ] as const satisfies ReadonlyArray<
    readonly [JapaneseCharacterClass, "before" | "after", number, number]
  >)(
    "%s on the %s side with %sem spacing admits %sem overhang",
    (lexicalClass, side, spacing, expected) => {
      const neighbor: RubyBoundary = { lexicalClass, effectiveClass: lexicalClass, advanceEm: 1 };

      const overhang = RubyBoundary.overhang(neighbor, side, spacing, 0.5);

      expect(overhang).toBe(expected);
    },
  );

  test("keeps ruby context separate from the neighbor's lexical class", () => {
    const neighbor: RubyBoundary = { lexicalClass: "cl-15", effectiveClass: "cl-22", advanceEm: 1 };

    const overhang = RubyBoundary.overhang(neighbor, "before", 0, 0.5);

    expect(overhang).toBe(0);
    expect(neighbor.lexicalClass).toBe("cl-15");
  });
});
