import { describe, expect, test } from "vite-plus/test";

import { BoundaryRule } from "./boundary-rule";
import { defaultJapaneseTypesettingProfile } from "./japanese-typesetting-profile";

describe("boundary resolution", () => {
  test("allows different inseparable marks to break and expand", () => {
    const context = {
      runInterior: false,
      rubyInterior: false,
      rubySpacingInterior: false,
      sourceGap: false,
      bindingSequence: false,
    } as const;

    const boundary = BoundaryRule.resolve(
      "cl-08",
      "cl-08",
      defaultJapaneseTypesettingProfile,
      context,
    );

    expect(boundary.break).toEqual({ kind: "allowed", penalty: 0 });
    expect(boundary.spacing).toMatchObject({
      kind: "glue",
      naturalWidthEm: 0,
      stretch: { amountEm: 0.25 },
    });
    expect(boundary.finalStretch).toBe(true);
  });

  test.each(["cl-22", "cl-23"] as const)(
    "uses the ruby complex spacing against Western text for %s",
    (rubyClass) => {
      const context = {
        runInterior: false,
        rubyInterior: false,
        rubySpacingInterior: false,
        sourceGap: false,
        bindingSequence: false,
      } as const;

      const boundary = BoundaryRule.resolve(
        rubyClass,
        "cl-27",
        defaultJapaneseTypesettingProfile,
        context,
      );

      expect(boundary.spacing).toMatchObject({
        naturalWidthEm: 0.25,
        shrink: { amountEm: 0.125 },
        stretch: { amountEm: 0.25 },
      });
      expect(boundary.break).toEqual({ kind: "allowed", penalty: 0 });
    },
  );

  test("admits spacing before small kana while prohibiting a break", () => {
    const context = {
      runInterior: false,
      rubyInterior: false,
      rubySpacingInterior: false,
      sourceGap: false,
      bindingSequence: false,
    } as const;

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

  test.each(["cl-22", "cl-23"] as const)(
    "separates break permission from spacing inside %s",
    (rubyClass) => {
      const context = {
        runInterior: false,
        rubyInterior: false,
        rubySpacingInterior: true,
        sourceGap: false,
        bindingSequence: false,
      } as const;

      const boundary = BoundaryRule.resolve(
        rubyClass,
        rubyClass,
        defaultJapaneseTypesettingProfile,
        context,
      );

      expect(boundary.break).toEqual({ kind: "allowed", penalty: 0 });
      expect(boundary.spacing).toBeNull();
      expect(boundary.finalStretch).toBe(false);
    },
  );

  test.each(["cl-22", "cl-23"] as const)(
    "allows spacing between separate %s complexes",
    (rubyClass) => {
      const context = {
        runInterior: false,
        rubyInterior: false,
        rubySpacingInterior: false,
        sourceGap: false,
        bindingSequence: false,
      } as const;

      const boundary = BoundaryRule.resolve(
        rubyClass,
        rubyClass,
        defaultJapaneseTypesettingProfile,
        context,
      );

      expect(boundary.break).toEqual({ kind: "allowed", penalty: 0 });
      expect(boundary.spacing).toMatchObject({ naturalWidthEm: 0, stretch: { amountEm: 0.25 } });
      expect(boundary.finalStretch).toBe(true);
    },
  );

  test.each(["runInterior", "rubyInterior"] as const)(
    "protects %s independently from character-class prohibitions",
    (protection) => {
      const context = {
        runInterior: false,
        rubyInterior: false,
        sourceGap: false,
        bindingSequence: false,
        [protection]: true,
        rubySpacingInterior: protection === "rubyInterior",
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
