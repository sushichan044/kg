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
          stretch: { priority: 1, amountEm: 1 },
        }
      : { kind: "glue", naturalWidthEm: 0 },
  breakPenalty: () => 0,
  canHang: () => false,
  lineStartSpacing: () => null,
  lineEndSpacing: () => null,
};

function atoms(text: string): ParagraphAtom[] {
  return text.split("").map((value) => ({
    value,
    boxAdvanceEm: 1,
    sourceGap: false,
    characterClass: flexiblePrefixProfile.classify({ value, presentation: "mixed" }),
    pairSpacingAfter: true,
  }));
}

describe("layoutParagraph", () => {
  test("optimizes the whole paragraph instead of taking the greedy first break", () => {
    const plans = layoutParagraph(
      atoms("AAAABBBBBBB"),
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

  test("keeps candidate expansion linear in paragraph length", () => {
    const paragraph = atoms("A".repeat(2_000));

    const startedAt = Date.now();
    const plans = layoutParagraph(paragraph, 20, flexiblePrefixProfile, () => true);
    const elapsedMs = Date.now() - startedAt;

    expect(plans).toHaveLength(100);
    expect(elapsedMs).toBeLessThan(2_000);
  });
});
