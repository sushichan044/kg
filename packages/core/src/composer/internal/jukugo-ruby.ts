export type JukugoReading = Readonly<{
  baseOffsetEm: number;
  baseAdvanceEm: number;
  readingAdvanceEm: number;
  beforeEm: number;
  afterEm: number;
}>;

export type JukugoRuby =
  | Readonly<{ kind: "placed"; offsetsEm: readonly number[] }>
  | Readonly<{ kind: "needs-spacing"; afterIndex: number; amountEm: number }>;

export const JukugoRuby = {
  // Appendix F: first try the succeeding base; move earlier readings only when
  // the suffix cannot fit. Bounds limit each segment to one ruby em of overhang.
  resolve: (readings: readonly JukugoReading[]): JukugoRuby => {
    const latest: number[] = [];
    let following = Number.POSITIVE_INFINITY;
    for (let index = readings.length - 1; index >= 0; index -= 1) {
      const reading = readings[index];
      if (reading === undefined) continue;
      const upper =
        reading.baseOffsetEm + reading.baseAdvanceEm + reading.afterEm - reading.readingAdvanceEm;
      const position = Math.min(upper, following - reading.readingAdvanceEm);
      const lower = reading.baseOffsetEm - reading.beforeEm;
      if (position < lower - 1e-9)
        return { kind: "needs-spacing", afterIndex: index, amountEm: lower - position };
      latest[index] = position;
      following = position;
    }
    const offsetsEm: number[] = [];
    let precedingEnd = Number.NEGATIVE_INFINITY;
    for (const [index, reading] of readings.entries()) {
      const preferred =
        reading.baseOffsetEm + Math.max(0, (reading.baseAdvanceEm - reading.readingAdvanceEm) / 2);
      const position = Math.max(
        precedingEnd,
        reading.baseOffsetEm - reading.beforeEm,
        Math.min(preferred, latest[index] ?? preferred),
      );
      offsetsEm.push(position);
      precedingEnd = position + reading.readingAdvanceEm;
    }
    return { kind: "placed", offsetsEm };
  },
} as const;
