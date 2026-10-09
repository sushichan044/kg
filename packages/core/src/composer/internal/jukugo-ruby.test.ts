import { describe, expect, test } from "vite-plus/test";

import { JukugoRuby } from "./jukugo-ruby";
import type { JukugoReading } from "./jukugo-ruby";

function readings(lengths: readonly number[]): JukugoReading[] {
  return lengths.map((length, index) => ({
    baseOffsetEm: index,
    baseAdvanceEm: 1,
    intrinsicBaseAdvanceEm: 1,
    readingAdvanceEm: length,
    beforeEm: index === 0 ? 0 : 0.5,
    afterEm: index === lengths.length - 1 ? 0 : 0.5,
    beforeSpacingEm: 0,
    afterSpacingEm: 0,
  }));
}

describe("appendix F jukugo distribution", () => {
  test("allocates measured excess in proportion to long reading widths", () => {
    const result = JukugoRuby.resolve(readings([1.5, 2]), { head: false, tail: false });

    expect.assert(result.kind === "needs-spacing");
    expect(result.spacings[0]?.beforeEm).toBeCloseTo(9 / 28);
    expect(result.spacings[0]?.afterEm).toBeCloseTo(9 / 28);
    expect(result.spacings[1]?.beforeEm).toBeCloseTo(3 / 7);
    expect(result.spacings[1]?.afterEm).toBeCloseTo(3 / 7);
    expect(
      result.spacings.reduce((sum, spacing) => sum + spacing.beforeEm + spacing.afterEm, 0),
    ).toBeCloseTo(1.5);
  });

  test("omits short readings from spacing allocation", () => {
    const result = JukugoRuby.resolve(readings([1, 1.5, 1]), { head: false, tail: false });

    expect.assert(result.kind === "needs-spacing");
    expect(result.spacings).toEqual([
      { beforeEm: 0, afterEm: 0 },
      { beforeEm: 0.25, afterEm: 0.25 },
      { beforeEm: 0, afterEm: 0 },
    ]);
  });

  test("directs spacing inward at both line edges", () => {
    const result = JukugoRuby.resolve(readings([1.5, 1.5]), { head: true, tail: true });

    expect.assert(result.kind === "needs-spacing");
    expect(result.spacings).toEqual([
      { beforeEm: 0, afterEm: 0.5 },
      { beforeEm: 0.5, afterEm: 0 },
    ]);
  });

  test("uses physical width rather than the number of provider clusters", () => {
    // These widths can each be reported as a single cluster by a provider.
    const result = JukugoRuby.resolve(readings([1.25, 1.75]), { head: false, tail: false });

    expect.assert(result.kind === "needs-spacing");
    expect(result.spacings[0]?.beforeEm).toBeCloseTo(5 / 24);
    expect(result.spacings[1]?.beforeEm).toBeCloseTo(7 / 24);
  });

  test("retains shoulder placement when short readings need no expansion", () => {
    const result = JukugoRuby.resolve(readings([0.5, 0.5]), { head: false, tail: false });

    expect(result).toEqual({ kind: "placed", offsetsEm: [0, 1] });
  });

  test("aligns the last reading with a line tail", () => {
    const result = JukugoRuby.resolve(readings([0.5, 0.5]), { head: false, tail: true });

    expect(result).toEqual({ kind: "placed", offsetsEm: [0, 1.5] });
  });
});
