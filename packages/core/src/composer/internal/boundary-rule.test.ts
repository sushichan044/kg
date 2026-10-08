import { describe, expect, test } from "vite-plus/test";

import { BoundaryRule } from "./boundary-rule";
import { defaultJapaneseTypesettingProfile } from "./japanese-typesetting-profile";

describe("boundary resolution", () => {
  test("admits spacing before small kana while prohibiting a break", () => {
    const context = { runInterior: false, rubyInterior: false, sourceGap: false } as const;

    const boundary = BoundaryRule.resolve(
      "cl-19",
      "cl-11",
      defaultJapaneseTypesettingProfile,
      context,
    );

    expect(boundary.break).toEqual({ kind: "prohibited", reason: "line-head" });
    expect(boundary.spacing).toMatchObject({ naturalWidthEm: 0, stretch: { amountEm: 0.25 } });
    expect(boundary.finalStretch).toBe(true);
  });

  test.each(["runInterior", "rubyInterior"] as const)(
    "protects %s independently from character-class prohibitions",
    (protection) => {
      const context = {
        runInterior: false,
        rubyInterior: false,
        sourceGap: false,
        [protection]: true,
      };

      const boundary = BoundaryRule.resolve(
        "cl-19",
        "cl-19",
        defaultJapaneseTypesettingProfile,
        context,
      );

      expect(boundary.break).toEqual({
        kind: "prohibited",
        reason: protection === "runInterior" ? "run-interior" : "ruby-interior",
      });
      expect(boundary.spacing).toBeNull();
      expect(boundary.finalStretch).toBe(false);
    },
  );
});
