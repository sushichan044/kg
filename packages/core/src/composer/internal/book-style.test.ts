import { describe, expect, test } from "vite-plus/test";

import { defaultBookStyle } from "./book-style";
import {
  JapaneseTypesettingProfile,
  defaultJapaneseTypesettingProfile,
} from "./japanese-typesetting-profile";
import { defaultJapaneseTypesettingRules } from "./japanese-typesetting-rules";

describe("book style", () => {
  test("changes adjustment order and cost without changing admissible capacity", () => {
    const style = {
      ...defaultBookStyle,
      adjustment: () => ({ stage: 7, costPerEm: 2 }),
    };

    const profile = JapaneseTypesettingProfile.of(defaultJapaneseTypesettingRules, style);
    const spacing = profile.pairSpacing("cl-19", "cl-27");
    const original = defaultJapaneseTypesettingProfile.pairSpacing("cl-19", "cl-27");

    expect.assert(spacing.shrink !== undefined, "mixed text has no shrink capacity");
    expect.assert(original.shrink !== undefined, "default mixed text has no shrink capacity");
    expect(spacing.shrink).toEqual({
      stage: 7,
      costPerEm: 2,
      amountEm: 0.125,
      granularity: "continuous",
    });
    expect(spacing.naturalWidthEm).toBe(original.naturalWidthEm);
    expect(spacing.shrink.amountEm).toBe(original.shrink.amountEm);
    expect(spacing.shrink.granularity).toBe(original.shrink.granularity);
    expect(profile.breakPenalty("cl-19", "cl-27")).toBe(
      defaultJapaneseTypesettingProfile.breakPenalty("cl-19", "cl-27"),
    );
    expect(defaultJapaneseTypesettingProfile.pairSpacing("cl-19", "cl-27")).toEqual(original);
  });
});
