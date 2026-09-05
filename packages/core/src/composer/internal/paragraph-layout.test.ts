import { describe, expect, test } from "vite-plus/test";

import type { JapaneseTypesettingProfile } from "./japanese-typesetting-profile";
import { layoutParagraph } from "./paragraph-layout";
import type { ParagraphAtom } from "./paragraph-layout";

const flexiblePrefixProfile: JapaneseTypesettingProfile = {
  classify: ({ value }) => (value === "A" ? "cl-19" : "cl-27"),
  boxMetrics: (_characterClass, measuredAdvanceEm) => ({
    advanceEm: measuredAdvanceEm,
    renderOffsetEm: 0,
  }),
  pairSpacing: (left, right) =>
    left === "cl-19" && right === "cl-19"
      ? {
          kind: "glue",
          naturalWidthEm: 0,
          stretch: { priority: 1, amountEm: 1, granularity: "continuous" },
        }
      : { kind: "glue", naturalWidthEm: 0 },
  breakPenalty: () => 0,
  canHang: () => false,
  spacingCharacter: () => null,
  lineStartSpacing: () => null,
  lineEndSpacing: () => null,
};

const freeLineEndProfile: JapaneseTypesettingProfile = {
  classify: ({ value }) => (value === "P" ? "cl-07" : "cl-19"),
  boxMetrics: (_characterClass, measuredAdvanceEm) => ({
    advanceEm: measuredAdvanceEm,
    renderOffsetEm: 0,
  }),
  pairSpacing: (left, right) =>
    left === "cl-07" && right === "cl-07"
      ? { kind: "kern", naturalWidthEm: 0 }
      : { kind: "glue", naturalWidthEm: 0 },
  breakPenalty: () => 0,
  canHang: () => false,
  spacingCharacter: () => null,
  lineStartSpacing: () => null,
  lineEndSpacing: (last) =>
    last === "cl-07"
      ? {
          spacing: {
            kind: "glue",
            naturalWidthEm: 0.5,
            shrink: { priority: 0, amountEm: 0.5, granularity: "all-or-nothing" },
          },
          absorbsPrecedingEm: 0,
        }
      : null,
};

/**
 * The same all-or-nothing line end, with one visible half em mid-line for it to compete against.
 */
const lineEndAndCommaProfile: JapaneseTypesettingProfile = {
  ...freeLineEndProfile,
  pairSpacing: (_left, right) =>
    right === "cl-07"
      ? {
          kind: "glue",
          naturalWidthEm: 0.5,
          shrink: { priority: 2, amountEm: 0.5, granularity: "continuous" },
        }
      : { kind: "glue", naturalWidthEm: 0 },
};

/**
 * Three capacities the stages can be told apart by: a wide and a narrow space sharing stage 2, and
 * one stage-1 space that has to be spent out before either of them opens.
 */
const stagedProfile: JapaneseTypesettingProfile = {
  classify: ({ value }) => (value === "W" ? "cl-27" : value === "E" ? "cl-01" : "cl-19"),
  boxMetrics: (_characterClass, measuredAdvanceEm) => ({
    advanceEm: measuredAdvanceEm,
    renderOffsetEm: 0,
  }),
  pairSpacing: (_left, right) =>
    right === "cl-27"
      ? {
          kind: "glue",
          naturalWidthEm: 0,
          stretch: { priority: 2, amountEm: 0.75, granularity: "continuous" },
        }
      : right === "cl-01"
        ? {
            kind: "glue",
            naturalWidthEm: 0,
            stretch: { priority: 1, amountEm: 0.5, granularity: "continuous" },
          }
        : {
            kind: "glue",
            naturalWidthEm: 0,
            stretch: { priority: 2, amountEm: 0.25, granularity: "continuous" },
          },
  breakPenalty: () => 0,
  canHang: () => false,
  spacingCharacter: () => null,
  lineStartSpacing: () => null,
  lineEndSpacing: () => null,
};

function atoms(text: string, profile: JapaneseTypesettingProfile): ParagraphAtom[] {
  return text.split("").map((value) => ({
    value,
    boxAdvanceEm: 1,
    sourceGap: false,
    characterClass: profile.classify({ value, presentation: "mixed" }),
    pairSpacingAfter: true,
  }));
}

function spacingWidths(plan: { pairSpacings: ReadonlyArray<{ widthEm: number }> }): number[] {
  return plan.pairSpacings.map(({ widthEm }) => widthEm);
}

describe("layoutParagraph", () => {
  test("optimizes the whole paragraph instead of taking the greedy first break", () => {
    const plans = layoutParagraph(
      atoms("AAAABBBBBBB", flexiblePrefixProfile),
      4,
      flexiblePrefixProfile,
      (_left, right) => right !== 8,
    );

    expect(plans.map(({ end }) => end)).toEqual([3, 7, 11]);
    expect(plans.map(({ break: result }) => result.kind)).toEqual([
      "stretched",
      "natural",
      "paragraph-end",
    ]);
  });

  test("packs a line when the only shrink is invisible line-end space", () => {
    const paragraph = "AAAPP".split("").map((value) => ({
      value,
      boxAdvanceEm: value === "P" ? 0.5 : 1,
      sourceGap: false,
      characterClass: freeLineEndProfile.classify({ value, presentation: "mixed" }),
      pairSpacingAfter: true,
    }));

    const plans = layoutParagraph(paragraph, 4, freeLineEndProfile, () => true);

    expect(plans.map(({ end }) => end)).toEqual([5]);
    expect(plans.map(({ break: result }) => result.kind)).toEqual(["shrunk"]);
  });

  test("leaves a line-end アキ whole when the overflow is smaller than it", () => {
    // Three and a half em in a 3.2 em line. The line-end half em cannot give three tenths of an em
    // without landing on a width JLReq 3.1.9 forbids, so the visible half em mid-line gives instead.
    const paragraph = "AAP".split("").map((value) => ({
      value,
      boxAdvanceEm: value === "P" ? 0.5 : 1,
      sourceGap: false,
      characterClass: lineEndAndCommaProfile.classify({ value, presentation: "mixed" }),
      pairSpacingAfter: true,
    }));

    const plans = layoutParagraph(paragraph, 3.2, lineEndAndCommaProfile, () => true);
    const line = plans[0];
    expect.assert(line !== undefined, "layout has no line");

    expect(plans).toHaveLength(1);
    expect(line.break.kind).toBe("shrunk");
    expect(spacingWidths(line)).toEqual([0, expect.closeTo(0.2, 10), 0.5]);
  });

  test("refuses to shrink when only an oversized line-end アキ is left", () => {
    // Three em in a 2.8 em line, and the line end is the only capacity there is. Taking a fifth of
    // its half em is what 3.1.9 forbids, so the line is not a shrunk line at all.
    const paragraph = "AAP".split("").map((value) => ({
      value,
      boxAdvanceEm: value === "P" ? 0.5 : 1,
      sourceGap: false,
      characterClass: freeLineEndProfile.classify({ value, presentation: "mixed" }),
      pairSpacingAfter: true,
    }));

    const plans = layoutParagraph(paragraph, 2.8, freeLineEndProfile, () => true);
    const line = plans.at(-1);
    expect.assert(line !== undefined, "layout has no line");

    expect(line.break.kind).not.toBe("shrunk");
    expect(spacingWidths(line)).toContain(0.5);
  });

  test("spreads one stage in proportion to what each space can give", () => {
    // A narrow space of a quarter em and a wide one of three quarters share stage 2. Half an em of
    // shortfall goes into them as an eighth and three eighths, not a quarter into each until the
    // first one runs dry.
    const plans = layoutParagraph(
      atoms("AAWAA", stagedProfile),
      3.5,
      stagedProfile,
      (_left, right) => right === 3,
    );
    const firstLine = plans[0];
    expect.assert(firstLine !== undefined, "layout has no first line");

    expect(firstLine.break.kind).toBe("stretched");
    expect(spacingWidths(firstLine)).toEqual([0.125, 0.375]);
  });

  test("spends the earlier stage out before opening the next one", () => {
    // Stage 1 holds half an em on its own; stage 2 holds a quarter em twice. Three quarters of an em
    // of shortfall empties stage 1 and then splits what is left across both spaces of stage 2.
    const plans = layoutParagraph(
      atoms("AEAAAA", stagedProfile),
      4.75,
      stagedProfile,
      (_left, right) => right === 4,
    );
    const firstLine = plans[0];
    expect.assert(firstLine !== undefined, "layout has no first line");

    expect(firstLine.break.kind).toBe("stretched");
    expect(spacingWidths(firstLine)).toEqual([0.5, 0.125, 0.125]);
  });

  test("keeps candidate expansion linear in paragraph length", () => {
    const paragraph = atoms("A".repeat(2_000), flexiblePrefixProfile);

    const startedAt = Date.now();
    const plans = layoutParagraph(paragraph, 20, flexiblePrefixProfile, () => true);
    const elapsedMs = Date.now() - startedAt;

    expect(plans).toHaveLength(100);
    expect(elapsedMs).toBeLessThan(2_000);
  });
});
