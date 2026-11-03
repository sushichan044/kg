import { expect, test } from "vite-plus/test";

import { CandidateLine } from "./candidate-line";
import { defaultParagraphEvaluation } from "./paragraph-evaluation";
import type { SpacingSlot } from "./spacing-slot";

function expandedLine(slotCount: number, excessPerSlotEm: number): CandidateLine {
  const slots: SpacingSlot[] = Array.from({ length: slotCount }, (_, index) => ({
    kind: "gap",
    boundary: index + 1,
  }));
  return CandidateLine.resolve(
    {
      start: 0,
      contentStart: 0,
      end: slotCount + 1,
      suppressedIndexes: [],
      boxesSizeEm: 6 - slotCount * excessPerSlotEm,
      terminal: false,
      lastVisible: slotCount,
      lastAdvance: 1,
      canHang: false,
      pairValues: slots.map((slot) => ({ slot, spacing: { kind: "glue", naturalWidthEm: 0 } })),
      unitsFor: () => [],
      finalExpansion: { slots, costPerEm: 4 },
    },
    6,
  );
}

test("prefers less total expansion over a smaller excess spread across more gaps", () => {
  const oneGap = expandedLine(1, 0.1);
  const fourGaps = expandedLine(4, 0.08);

  const oneGapScore = defaultParagraphEvaluation.scoreFor(oneGap, 0).score;
  const fourGapScore = defaultParagraphEvaluation.scoreFor(fourGaps, 0).score;

  expect(oneGap.break.kind).toBe("stretched");
  expect(fourGaps.break.kind).toBe("stretched");
  expect(oneGapScore[1]).toBeLessThan(fourGapScore[1]);
});
