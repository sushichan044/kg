import { describe, expect, test } from "vite-plus/test";

import { BoundaryRule } from "./boundary-rule";
import { JapaneseParagraph } from "./japanese-paragraph";
type JapaneseParagraphCharacter = Parameters<typeof JapaneseParagraph.of>[0][number];
import { defaultJapaneseTypesettingProfile } from "./japanese-typesetting-profile";
import type { JapaneseTypesettingProfile } from "./japanese-typesetting-profile";
import { layoutParagraph as optimizeParagraph } from "./paragraph-layout";

type ParagraphFixtureCharacter = Omit<JapaneseParagraphCharacter, "effectiveClass">;

function prepareParagraph(
  characters: readonly ParagraphFixtureCharacter[],
  lineLengthEm: number,
  profile: JapaneseTypesettingProfile,
) {
  const boundaries = characters.map((right, boundary) => {
    const left = characters[boundary - 1];
    return left === undefined
      ? undefined
      : BoundaryRule.resolve(left.characterClass, right.characterClass, profile, {
          runInterior: false,
          rubyInterior: false,
          rubySpacingInterior: false,
          bindingSequence: false,
          sourceGap: left.sourceGap || right.sourceGap,
        });
  });
  return JapaneseParagraph.of(
    characters.map((character) => ({ ...character, effectiveClass: character.characterClass })),
    boundaries,
    profile,
    lineLengthEm,
  );
}

function layoutParagraph(
  characters: readonly ParagraphFixtureCharacter[],
  lineLengthEm: number,
  profile: JapaneseTypesettingProfile,
  boundaryAllowed: (left: number, right: number) => boolean,
) {
  const paragraph = prepareParagraph(characters, lineLengthEm, profile);
  return optimizeParagraph(
    paragraph.elements,
    lineLengthEm,
    (start, end) => paragraph.resolveCandidate(start, end),
    boundaryAllowed,
  );
}

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
          stretch: { stage: 1, costPerEm: 1, amountEm: 1, granularity: "continuous" },
        }
      : { kind: "glue", naturalWidthEm: 0 },
  finalStretchCostPerEm: 2,
  canExpandAtFinalStage: () => true,
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
  finalStretchCostPerEm: 1,
  canExpandAtFinalStage: () => false,
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
            shrink: { stage: 0, costPerEm: 0, amountEm: 0.5, granularity: "all-or-nothing" },
          },
          absorbsPrecedingEm: 0,
        }
      : null,
};

/**
 * 同じく二分アキかベタ組かの二択の行末に、競合相手として行中の見える二分を一つ加えたもの。
 */
const lineEndAndCommaProfile: JapaneseTypesettingProfile = {
  ...freeLineEndProfile,
  pairSpacing: (_left, right) =>
    right === "cl-07"
      ? {
          kind: "glue",
          naturalWidthEm: 0.5,
          shrink: { stage: 2, costPerEm: 2, amountEm: 0.5, granularity: "continuous" },
        }
      : { kind: "glue", naturalWidthEm: 0 },
};

/**
 * 段階を見分けられる三つの調整可能量。第2段階を共有する広いアキと狭いアキ、
 * そしてどちらかが空く前に使い切る必要がある第1段階のアキ一つ。
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
          stretch: { stage: 2, costPerEm: 2, amountEm: 0.75, granularity: "continuous" },
        }
      : right === "cl-01"
        ? {
            kind: "glue",
            naturalWidthEm: 0,
            stretch: { stage: 1, costPerEm: 1, amountEm: 0.5, granularity: "continuous" },
          }
        : {
            kind: "glue",
            naturalWidthEm: 0,
            stretch: { stage: 2, costPerEm: 2, amountEm: 0.25, granularity: "continuous" },
          },
  finalStretchCostPerEm: 3,
  canExpandAtFinalStage: () => true,
  breakPenalty: () => 0,
  canHang: () => false,
  spacingCharacter: () => null,
  lineStartSpacing: () => null,
  lineEndSpacing: () => null,
};

const finalStageProfile: JapaneseTypesettingProfile = {
  ...flexiblePrefixProfile,
  classify: ({ value }) => (value === "W" ? "cl-27" : "cl-19"),
  pairSpacing: (_left, right) =>
    right === "cl-27"
      ? {
          kind: "glue",
          naturalWidthEm: 0,
          stretch: { stage: 1, costPerEm: 1, amountEm: 0.5, granularity: "continuous" },
        }
      : { kind: "glue", naturalWidthEm: 0 },
};

const cappedWordSpaceProfile: JapaneseTypesettingProfile = {
  ...flexiblePrefixProfile,
  classify: ({ value }) => (value === " " ? "cl-26" : "cl-19"),
  boxMetrics: (characterClass, measuredAdvanceEm) => ({
    advanceEm: characterClass === "cl-26" ? 0 : measuredAdvanceEm,
    renderOffsetEm: 0,
  }),
  pairSpacing: (left, right) =>
    left === "cl-26" || right === "cl-26"
      ? { kind: "glue", naturalWidthEm: 0 }
      : {
          kind: "glue",
          naturalWidthEm: 0,
          stretch: { stage: 2, costPerEm: 2, amountEm: 0.25, granularity: "continuous" },
        },
  finalStretchCostPerEm: 3,
  canExpandAtFinalStage: (left, right) => left !== "cl-26" && right !== "cl-26",
  spacingCharacter: (characterClass, position) =>
    characterClass === "cl-26" && position === "mid-line"
      ? {
          kind: "glue",
          naturalWidthEm: 1 / 3,
          stretch: {
            stage: 1,
            costPerEm: 1,
            amountEm: 1 / 2 - 1 / 3,
            granularity: "continuous",
          },
        }
      : null,
};

function atoms(text: string, profile: JapaneseTypesettingProfile): ParagraphFixtureCharacter[] {
  return text.split("").map((value) => {
    const characterClass = profile.classify({ value, presentation: "mixed" });
    return {
      value,
      boxAdvanceEm: profile.boxMetrics(characterClass, 1).advanceEm,
      sourceGap: false,
      characterClass,
    };
  });
}

function spacingWidths(plan: { pairSpacings: ReadonlyArray<{ widthEm: number }> }): number[] {
  return plan.pairSpacings.map(({ widthEm }) => widthEm);
}

describe("layoutParagraph", () => {
  test.each([
    {
      description: "prefers bounded layouts even when final expansion has very small cubic badness",
      firstRatio: 1.0005,
      alternativeRatio: 0.5,
    },
    {
      description:
        "distributes unavoidable final expansion instead of concentrating it in one line",
      firstRatio: 4,
      alternativeRatio: 1.2,
    },
  ])("$description", ({ firstRatio, alternativeRatio }) => {
    const paragraph = atoms("AAAA", flexiblePrefixProfile);
    const prepared = prepareParagraph(paragraph, 2, flexiblePrefixProfile);
    const ratios = new Map([
      ["0:1", firstRatio],
      ["1:4", 0],
      ["0:2", alternativeRatio],
      ["2:3", alternativeRatio],
      ["3:4", 0],
    ]);

    const plans = optimizeParagraph(
      paragraph,
      2,
      (start, end) => {
        const ratio = ratios.get(`${start}:${end}`);
        return ratio === undefined
          ? undefined
          : {
              ...prepared.resolveCandidate(start, end),
              inlineSizeEm: 2,
              break: { kind: ratio === 0 ? "paragraph-end" : "stretched" },
              deformationRatio: ratio,
              deformationCost: ratio,
              finalExpansionBadness: Math.max(0, ratio - 1) ** 3,
            };
      },
      () => true,
    );

    expect(plans.map(({ end }) => end)).toEqual([2, 3, 4]);
  });
  test("keeps paths with different continuation positions until a complete path is selected", () => {
    const paragraph = atoms("AAAA", flexiblePrefixProfile);
    const prepared = prepareParagraph(paragraph, 2, flexiblePrefixProfile);
    const calls = new Set<string>();
    const transitions = new Map([
      ["0:1:0", 1],
      ["0:2:0", 2],
      ["1:3:1", 5],
      ["2:3:2", 6],
      ["3:4:5", 0],
    ]);

    const plans = optimizeParagraph(
      paragraph,
      2,
      (start, end, cursor) => {
        const key = `${start}:${end}:${cursor}`;
        expect(calls.has(key)).toBe(false);
        calls.add(key);
        const nextCursor = transitions.get(key);
        return nextCursor === undefined
          ? undefined
          : {
              ...prepared.resolveCandidate(start, end),
              break: { kind: "natural" },
              deformationCost: 0,
              deformationRatio: 0,
              nextCursor,
            };
      },
      () => true,
    );

    expect(plans.map((line) => [line.start, line.end])).toEqual([
      [0, 1],
      [1, 3],
      [3, 4],
    ]);
  });
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
    }));

    const plans = layoutParagraph(paragraph, 4, freeLineEndProfile, () => true);

    expect(plans.map(({ end }) => end)).toEqual([5]);
    expect(plans.map(({ break: result }) => result.kind)).toEqual(["shrunk"]);
  });

  test("leaves a line-end アキ whole when the overflow is smaller than it", () => {
    // 3.2字の行に3字半。行末の二分から全角の10分の3を詰めると JLReq 3.1.9 が禁じる幅になるので、
    // 代わりに行中の見える二分を詰める。
    const paragraph = "AAP".split("").map((value) => ({
      value,
      boxAdvanceEm: value === "P" ? 0.5 : 1,
      sourceGap: false,
      characterClass: lineEndAndCommaProfile.classify({ value, presentation: "mixed" }),
    }));

    const plans = layoutParagraph(paragraph, 3.2, lineEndAndCommaProfile, () => true);
    const line = plans[0];
    expect.assert(line !== undefined, "layout has no line");

    expect(plans).toHaveLength(1);
    expect(line.break.kind).toBe("shrunk");
    expect(spacingWidths(line)).toEqual([0, expect.closeTo(0.2, 10), 0.5]);
  });

  test("refuses to shrink when only an oversized line-end アキ is left", () => {
    // 2.8字の行に3字で、調整可能量は行末にしかない。
    // その二分から全角の5分の1を詰めることは 3.1.9 が禁じているので、この行は詰めた行にはならない。
    const paragraph = "AAP".split("").map((value) => ({
      value,
      boxAdvanceEm: value === "P" ? 0.5 : 1,
      sourceGap: false,
      characterClass: freeLineEndProfile.classify({ value, presentation: "mixed" }),
    }));

    const plans = layoutParagraph(paragraph, 2.8, freeLineEndProfile, () => true);
    const line = plans.at(-1);
    expect.assert(line !== undefined, "layout has no line");

    expect(line.break.kind).not.toBe("shrunk");
    expect(spacingWidths(line)).toContain(0.5);
  });

  test("spreads one stage in proportion to what each space can give", () => {
    // 四分の狭いアキと全角の4分の3の広いアキが第2段階を共有する。
    // 二分の不足は、最初のアキが尽きるまでそれぞれに四分ずつ入れるのではなく、
    // 八分と全角の8分の3に分けて入れる。
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
    // 第1段階だけで二分を持ち、第2段階は四分を二つ持つ。全角の4分の3の不足は、
    // まず第1段階を使い切り、残りを第2段階の二つのアキに分ける。
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

  test("spreads the final-stage remainder evenly across every eligible gap", () => {
    // 最初の字間は、最終段階より前に上限の二分に達する。残りの全角の10分の3は、その後、
    // 前の段階で使った字間も含めて、3か所すべてに均等に加える。
    const plans = layoutParagraph(
      atoms("AWAAA", finalStageProfile),
      4.8,
      finalStageProfile,
      (_left, right) => right === 4,
    );
    const firstLine = plans[0];
    expect.assert(firstLine !== undefined, "layout has no first line");

    expect(firstLine.break.kind).toBe("stretched");
    expect(spacingWidths(firstLine)).toEqual([
      expect.closeTo(0.6, 10),
      expect.closeTo(0.1, 10),
      expect.closeTo(0.1, 10),
    ]);
    expect(firstLine.inlineSizeEm).toBe(4.8);
  });

  test("caps spacing around a western word before applying the final stage elsewhere", () => {
    const plans = layoutParagraph(
      atoms("あいうURLえおか後続文章です", defaultJapaneseTypesettingProfile),
      12,
      defaultJapaneseTypesettingProfile,
      (_left, right) => right === 9,
    );
    const firstLine = plans[0];
    expect.assert(firstLine !== undefined, "layout has no first line");

    expect(firstLine.break.kind).toBe("stretched");
    expect(spacingWidths(firstLine)).toEqual([0.5, 0.5, 0.5, 0, 0, 0.5, 0.5, 0.5]);
    expect(firstLine.inlineSizeEm).toBe(12);
  });

  test("caps a western word space before applying the final stage elsewhere", () => {
    const paragraph = atoms("AA AAABBBBB", cappedWordSpaceProfile);
    const plans = layoutParagraph(
      paragraph,
      7,
      cappedWordSpaceProfile,
      (_left, right) => right === 6,
    );
    const firstLine = plans[0];
    expect.assert(firstLine !== undefined, "layout has no first line");

    expect(firstLine.break.kind).toBe("stretched");
    expect(firstLine.characterSpacings.map(({ widthEm }) => widthEm)).toEqual([0.5]);
    expect(spacingWidths(firstLine)).toEqual([0.5, 0, 0, 0.5, 0.5]);
    expect(firstLine.inlineSizeEm).toBe(7);
  });

  test("keeps candidate expansion linear in paragraph length", () => {
    const paragraph = atoms("A".repeat(2_000), flexiblePrefixProfile);
    const lineLengthEm = 20;
    let resolvedCandidates = 0;

    const startedAt = Date.now();
    const prepared = prepareParagraph(paragraph, lineLengthEm, flexiblePrefixProfile);
    const plans = optimizeParagraph(
      prepared.elements,
      lineLengthEm,
      (start, end) => {
        resolvedCandidates += 1;
        return prepared.resolveCandidate(start, end);
      },
      () => true,
    );
    const elapsedMs = Date.now() - startedAt;

    expect(plans).toHaveLength(100);
    // 幅1のボックスは、行長の2倍に番兵を加えたところで探索の打ち切りに達する。
    expect(resolvedCandidates).toBeLessThanOrEqual(paragraph.length * (2 * lineLengthEm + 1));
    expect(elapsedMs).toBeLessThan(2_000);
  });
});
