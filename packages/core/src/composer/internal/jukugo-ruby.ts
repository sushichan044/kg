const EPSILON = 1e-9;

export type JukugoReading = Readonly<{
  baseOffsetEm: number;
  baseAdvanceEm: number;
  intrinsicBaseAdvanceEm: number;
  readingAdvanceEm: number;
  beforeEm: number;
  afterEm: number;
  beforeSpacingEm: number;
  afterSpacingEm: number;
}>;

export type JukugoEdges = Readonly<{ head: boolean; tail: boolean }>;
export type JukugoSpacing = Readonly<{ beforeEm: number; afterEm: number }>;
export type JukugoRuby =
  | Readonly<{ kind: "placed"; offsetsEm: readonly number[] }>
  | Readonly<{ kind: "needs-spacing"; spacings: readonly JukugoSpacing[] }>
  | Readonly<{ kind: "refused" }>;

type Bound = Readonly<{ positionEm: number; perSpacingEm: number }>;
type Bounds = Readonly<{ lower: readonly Bound[]; upper: readonly Bound[] }>;

function boundsFor(
  readings: readonly JukugoReading[],
  edges: JukugoEdges,
  spacings: readonly JukugoSpacing[],
  outer: boolean,
): Bounds[] {
  let shiftEm = 0;
  return readings.map((reading, index) => {
    const spacing = spacings[index] ?? { beforeEm: 0, afterEm: 0 };
    shiftEm += (spacings[index - 1]?.afterEm ?? 0) + spacing.beforeEm;
    const before = index === 0 && !outer ? 0 : reading.beforeEm;
    const after = index === readings.length - 1 && !outer ? 0 : reading.afterEm;
    const lower: Bound[] = [
      {
        positionEm: reading.baseOffsetEm - before - reading.beforeSpacingEm,
        perSpacingEm: shiftEm - spacing.beforeEm,
      },
    ];
    const upper: Bound[] = [
      {
        positionEm:
          reading.baseOffsetEm +
          reading.baseAdvanceEm +
          after +
          reading.afterSpacingEm -
          reading.readingAdvanceEm,
        perSpacingEm: shiftEm + spacing.afterEm,
      },
    ];
    if (index === 0 && edges.head) {
      const head = { positionEm: reading.baseOffsetEm, perSpacingEm: shiftEm };
      lower.push(head);
      upper.push(head);
    } else if (index === readings.length - 1 && edges.tail) {
      const tail = {
        positionEm: reading.baseOffsetEm + reading.baseAdvanceEm - reading.readingAdvanceEm,
        perSpacingEm: shiftEm,
      };
      lower.push(tail);
      upper.push(tail);
    }
    return { lower, upper };
  });
}

function place(
  readings: readonly JukugoReading[],
  bounds: readonly Bounds[],
): number[] | undefined {
  const latest: number[] = [];
  let following = Number.POSITIVE_INFINITY;
  for (let index = readings.length - 1; index >= 0; index -= 1) {
    const reading = readings[index];
    const bound = bounds[index];
    if (reading === undefined || bound === undefined) return undefined;
    const upper = Math.min(...bound.upper.map(({ positionEm }) => positionEm));
    const position = Math.min(upper, following - reading.readingAdvanceEm);
    if (position < Math.max(...bound.lower.map(({ positionEm }) => positionEm)) - EPSILON)
      return undefined;
    latest[index] = position;
    following = position;
  }
  const offsetsEm: number[] = [];
  let precedingEnd = Number.NEGATIVE_INFINITY;
  for (const [index, reading] of readings.entries()) {
    const bound = bounds[index];
    if (bound === undefined) return undefined;
    const position = Math.max(
      precedingEnd,
      ...bound.lower.map(({ positionEm }) => positionEm),
      Math.min(reading.baseOffsetEm, latest[index] ?? reading.baseOffsetEm),
    );
    offsetsEm.push(position);
    precedingEnd = position + reading.readingAdvanceEm;
  }
  return offsetsEm;
}

export const JukugoRuby = {
  resolve: (readings: readonly JukugoReading[], edges: JukugoEdges): JukugoRuby => {
    const empty = readings.map(() => ({ beforeEm: 0, afterEm: 0 }));
    // F.2 prefers borrowing within the compound before using its outside neighbours.
    for (const outer of [false, true]) {
      const offsetsEm = place(readings, boundsFor(readings, edges, empty, outer));
      if (offsetsEm !== undefined) return { kind: "placed", offsetsEm };
    }
    const weights = readings.map((reading) =>
      reading.readingAdvanceEm > reading.intrinsicBaseAdvanceEm + EPSILON
        ? reading.readingAdvanceEm
        : 0,
    );
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= EPSILON) return { kind: "refused" };
    const shares = weights.map((weight, index) => {
      const share = weight / total;
      if (index === 0 && edges.head) return { beforeEm: 0, afterEm: share };
      if (index === readings.length - 1 && edges.tail) return { beforeEm: share, afterEm: 0 };
      return { beforeEm: share / 2, afterEm: share / 2 };
    });
    const bounds = boundsFor(readings, edges, shares, true);
    let amountEm = 0;
    // Every contiguous reading interval must fit between its endpoint bounds.
    // Solve those linear inequalities without retaining a quadratic constraint graph.
    for (let start = 0; start < readings.length; start += 1) {
      let advanceEm = 0;
      for (let end = start; end < readings.length; end += 1) {
        const reading = readings[end];
        if (reading === undefined) return { kind: "refused" };
        advanceEm += reading.readingAdvanceEm;
        for (const lower of bounds[start]?.lower ?? []) {
          for (const upper of bounds[end]?.upper ?? []) {
            const missing =
              advanceEm - reading.readingAdvanceEm + lower.positionEm - upper.positionEm;
            if (missing <= EPSILON) continue;
            const capacity = upper.perSpacingEm - lower.perSpacingEm;
            if (capacity <= EPSILON) return { kind: "refused" };
            amountEm = Math.max(amountEm, missing / capacity);
          }
        }
      }
    }
    if (amountEm <= EPSILON) return { kind: "refused" };
    return {
      kind: "needs-spacing",
      spacings: shares.map((share) => ({
        beforeEm: share.beforeEm * amountEm,
        afterEm: share.afterEm * amountEm,
      })),
    };
  },
} as const;
