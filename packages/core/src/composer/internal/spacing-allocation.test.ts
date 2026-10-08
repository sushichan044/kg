import { describe, expect, test } from "vite-plus/test";

import type { AdjustmentUnit } from "./adjustment-unit";
import { resolveSpacings } from "./spacing-allocation";
import type { SpacingOpportunity } from "./spacing-opportunity";

const first = { kind: "gap", boundary: 1 } as const;
const second = { kind: "gap", boundary: 2 } as const;
const spaces: readonly SpacingOpportunity[] = [
  { slot: first, spacing: { kind: "glue", naturalWidthEm: 0.5 } },
  { slot: second, spacing: { kind: "glue", naturalWidthEm: 0.5 } },
];
const noFinalExpansion = { slots: [], costPerEm: 4 } as const;

describe("spacing allocation", () => {
  test("spends stages in order even when an earlier stage costs more", () => {
    const units: readonly AdjustmentUnit[] = [
      {
        direction: "shrink",
        kind: "continuous",
        stage: 1,
        costPerEm: 8,
        parts: [{ slot: first, capacityEm: 0.5 }],
      },
      {
        direction: "shrink",
        kind: "continuous",
        stage: 2,
        costPerEm: 1,
        parts: [{ slot: second, capacityEm: 0.5 }],
      },
    ];

    const result = resolveSpacings(spaces, units, "shrink", 0.5, noFinalExpansion);

    expect(result.spacings.pairSpacings.map(({ widthEm }) => widthEm)).toEqual([0, 0.5]);
    expect(result.deformationCost).toBe(4);
    expect(result.freeEm).toBe(0);
    expect(result.unabsorbedEm).toBe(0);
  });

  test("recognizes a zero-cost reduction at a later stage", () => {
    const units: readonly AdjustmentUnit[] = [
      {
        direction: "shrink",
        kind: "continuous",
        stage: 7,
        costPerEm: 0,
        parts: [{ slot: first, capacityEm: 0.5 }],
      },
    ];

    const result = resolveSpacings(spaces, units, "shrink", 0.25, noFinalExpansion);

    expect(result.spacings.pairSpacings.map(({ widthEm }) => widthEm)).toEqual([0.25, 0.5]);
    expect(result.deformationCost).toBe(0);
    expect(result.freeEm).toBe(0.25);
  });

  test.each([0.25, 0.5])(
    "spends a coupled half-em whole or skips it when asked for %s em",
    (amountEm) => {
      const units: readonly AdjustmentUnit[] = [
        {
          direction: "shrink",
          kind: "all-or-nothing",
          stage: 0,
          costPerEm: 0,
          parts: [
            { slot: first, capacityEm: 0.25 },
            { slot: second, capacityEm: 0.25 },
          ],
        },
      ];

      const result = resolveSpacings(spaces, units, "shrink", amountEm, noFinalExpansion);

      expect(result.spacings.pairSpacings.map(({ widthEm }) => widthEm)).toEqual(
        amountEm === 0.5 ? [0.25, 0.25] : [0.5, 0.5],
      );
      expect(result.unabsorbedEm).toBe(amountEm === 0.5 ? 0 : 0.25);
    },
  );

  test("uses the explicitly eligible slots for final expansion", () => {
    const units: readonly AdjustmentUnit[] = [
      {
        direction: "stretch",
        kind: "continuous",
        stage: 1,
        costPerEm: 1,
        parts: [{ slot: first, capacityEm: 0.25 }],
      },
    ];

    const result = resolveSpacings(spaces, units, "stretch", 1, { slots: [second], costPerEm: 4 });

    expect(result.spacings.pairSpacings.map(({ widthEm }) => widthEm)).toEqual([0.75, 1.25]);
    expect(result.deformationCost).toBe(3.25);
    expect(result.finalStretchPerSlotEm).toBe(0.75);
    expect(result.unabsorbedEm).toBe(0);
  });

  test("keeps capacities for the opposite direction out of allocation", () => {
    const units: readonly AdjustmentUnit[] = [
      {
        direction: "stretch",
        kind: "continuous",
        stage: 0,
        costPerEm: 0,
        parts: [{ slot: first, capacityEm: 0.5 }],
      },
    ];

    const result = resolveSpacings(spaces, units, "shrink", 0.25, noFinalExpansion);

    expect(result.spacings.pairSpacings.map(({ widthEm }) => widthEm)).toEqual([0.5, 0.5]);
    expect(result.unabsorbedEm).toBe(0.25);
  });
});
