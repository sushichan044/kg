import { describe, expect, test } from "vite-plus/test";

import { defaultJapaneseTypesettingProfile as profile } from "./japanese-typesetting-profile";
import type { JapaneseCharacterClass } from "./japanese-typesetting-rules";

// JLReq 2020 appendix B table 1, D table 3, E table 6. Each row gives
// natural, reducible, and expandable amounts with the ruby before/after its neighbor.
// Membership-dependent cells are tested separately through BoundaryRule.
// https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#spacing_between_characters
const neighbors = [
  ["cl-01", 0.5, 0, 0.5, 0, 0, 0, false, false],
  ["cl-02", 0, 0.5, 0, 0.5, 0, 0, false, false],
  ["cl-03", 0, 0, 0, 0, 0, 0, false, true],
  ["cl-04", 0, 0, 0, 0, 0, 0, false, true],
  ["cl-05", 0.25, 0.25, 0.25, 0.25, 0, 0, false, false],
  ["cl-06", 0, 0.5, 0, 0, 0, 0, false, false],
  ["cl-07", 0, 0.5, 0, 0.5, 0, 0, false, false],
  ["cl-08", 0, 0, 0, 0, 0.25, 0.25, true, true],
  ["cl-09", 0, 0, 0, 0, 0.25, 0.25, true, true],
  ["cl-10", 0, 0, 0, 0, 0.25, 0.25, true, true],
  ["cl-11", 0, 0, 0, 0, 0.25, 0.25, true, true],
  ["cl-12", 0, 0, 0, 0, 0.25, 0.25, true, true],
  ["cl-13", 0, 0, 0, 0, 0.25, 0.25, true, true],
  ["cl-14", 0, 0, 0, 0, 0, 0, false, false],
  ["cl-15", 0, 0, 0, 0, 0.25, 0.25, true, true],
  ["cl-16", 0, 0, 0, 0, 0.25, 0.25, true, true],
  ["cl-19", 0, 0, 0, 0, 0.25, 0.25, true, true],
  ["cl-24", 0.25, 0.25, 0.125, 0.125, 0.25, 0.25, false, false],
  ["cl-25", 0.25, 0.25, 0.125, 0.125, 0.25, 0.25, false, false],
  ["cl-26", 0, 0, 0, 0, 0, 0, false, false],
  ["cl-27", 0.25, 0.25, 0.125, 0.125, 0.25, 0.25, false, false],
  ["cl-30", 0, 0, 0, 0, 0.25, 0.25, true, true],
] as const satisfies ReadonlyArray<
  readonly [
    JapaneseCharacterClass,
    number,
    number,
    number,
    number,
    number,
    number,
    boolean,
    boolean,
  ]
>;

describe.each(["cl-22", "cl-23"] as const)("reference pair rules for %s", (rubyClass) => {
  test("uses solid line edges without punctuation hanging", () => {
    const paragraphHead = profile.lineStartSpacing(rubyClass, "paragraph-start");
    const turnedHead = profile.lineStartSpacing(rubyClass, "turned-over");
    const tail = profile.lineEndSpacing(rubyClass);

    expect(paragraphHead).toBeNull();
    expect(turnedHead).toBeNull();
    expect(tail).toBeNull();
    expect(profile.canHang(rubyClass)).toBe(false);
  });

  test.each(neighbors)(
    "matches both sides of %s",
    (
      neighbor,
      before,
      after,
      shrinkBefore,
      shrinkAfter,
      stretchBefore,
      stretchAfter,
      finalBefore,
      finalAfter,
    ) => {
      const preceding = profile.pairSpacing(rubyClass, neighbor);
      const following = profile.pairSpacing(neighbor, rubyClass);

      expect([preceding.naturalWidthEm, following.naturalWidthEm]).toEqual([before, after]);
      expect([preceding.shrink?.amountEm ?? 0, following.shrink?.amountEm ?? 0]).toEqual([
        shrinkBefore,
        shrinkAfter,
      ]);
      expect([preceding.stretch?.amountEm ?? 0, following.stretch?.amountEm ?? 0]).toEqual([
        stretchBefore,
        stretchAfter,
      ]);
      expect(profile.canExpandAtFinalStage(rubyClass, neighbor)).toBe(finalBefore);
      expect(profile.canExpandAtFinalStage(neighbor, rubyClass)).toBe(finalAfter);
      const forbiddenHeads = [
        "cl-02",
        "cl-03",
        "cl-04",
        "cl-05",
        "cl-06",
        "cl-07",
        "cl-09",
        "cl-10",
        "cl-11",
        "cl-13",
      ];
      expect(profile.breakPenalty(rubyClass, neighbor)).toBe(
        forbiddenHeads.includes(neighbor) ? null : 0,
      );
      expect(profile.breakPenalty(neighbor, rubyClass)).toBe(
        neighbor === "cl-01" || neighbor === "cl-12" ? null : 0,
      );
    },
  );
});
