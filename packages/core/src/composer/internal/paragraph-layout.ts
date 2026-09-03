import type { LineBreakResult } from "../line-break-result";
import type {
  JapaneseCharacterClass,
  JapaneseTypesettingProfile,
  LineHeadKind,
  PairSpacing,
  SpacingCapacity,
} from "./japanese-typesetting-profile";

const EPSILON = 1e-9;

/**
 * Spending capacity at this priority changes nothing the reader can see.
 */
const FREE_SHRINK_PRIORITY = 0;

export type ParagraphAtom = Readonly<{
  value: string;
  boxAdvanceEm: number;
  sourceGap: boolean;
  characterClass: JapaneseCharacterClass;
  pairSpacingAfter: boolean;
}>;

export type ResolvedPairSpacing = Readonly<{
  boundary: number;
  kind: PairSpacing["kind"];
  naturalWidthEm: number;
  widthEm: number;
}>;

export type ParagraphLinePlan = Readonly<{
  start: number;
  contentStart: number;
  end: number;
  suppressedIndexes: readonly number[];
  pairSpacings: readonly ResolvedPairSpacing[];
  inlineSizeEm: number;
  break: LineBreakResult;
  hangingIndex: number | null;
}>;

type Opportunity = Readonly<{
  boundary: number;
  spacing: PairSpacing;
  /**
   * How much of the preceding boundary's capacity this one is indivisible from, as the profile's
   * line-end spacing reports it. Zero everywhere else.
   */
  absorbsPrecedingEm: number;
}>;

/**
 * One indivisible amount of line adjustment: the boundaries it covers, the stage that spends it and
 * how much it holds. Almost every unit is a single boundary. A line end the profile says straddles
 * its last character is two, because JLReq 3.1.9 takes the アキ before and the アキ after that
 * character away together or not at all.
 */
type AdjustmentUnit = Readonly<{
  parts: ReadonlyArray<Readonly<{ boundary: number; amountEm: number }>>;
  priority: number;
  amountEm: number;
  granularity: SpacingCapacity["granularity"];
}>;

type Candidate = ParagraphLinePlan &
  Readonly<{
    deformationRatio: number;
    priorityCost: number;
  }>;

type Score = readonly [number, number, number, number, number, number, number];

type State = Readonly<{
  score: Score;
  fitness: number;
  previous: Readonly<{ index: number; fitness: number }> | null;
  line: Candidate | null;
  breaks: readonly number[];
}>;

function skipSourceGaps(atoms: readonly ParagraphAtom[], start: number): number {
  let cursor = start;
  while (atoms[cursor]?.sourceGap === true) cursor += 1;
  return cursor;
}

function previousVisible(atoms: readonly ParagraphAtom[], end: number): number | undefined {
  for (let index = end - 1; index >= 0; index -= 1) {
    if (atoms[index]?.sourceGap === false) return index;
  }
  return undefined;
}

function opportunities(
  atoms: readonly ParagraphAtom[],
  classes: readonly JapaneseCharacterClass[],
  start: number,
  end: number,
  profile: JapaneseTypesettingProfile,
  lineHead: LineHeadKind,
): Opportunity[] {
  const result: Opportunity[] = [];
  const firstClass = classes[start];
  const startSpacing =
    firstClass === undefined ? null : profile.lineStartSpacing(firstClass, lineHead);
  if (startSpacing !== null) {
    result.push({ boundary: start, spacing: startSpacing, absorbsPrecedingEm: 0 });
  }
  for (let right = start + 1; right < end; right += 1) {
    const leftAtom = atoms[right - 1];
    const rightAtom = atoms[right];
    const leftClass = classes[right - 1];
    const rightClass = classes[right];
    if (
      leftAtom === undefined ||
      rightAtom === undefined ||
      leftClass === undefined ||
      rightClass === undefined ||
      leftAtom.sourceGap ||
      rightAtom.sourceGap ||
      !leftAtom.pairSpacingAfter
    ) {
      continue;
    }
    result.push({
      boundary: right,
      spacing: profile.pairSpacing(leftClass, rightClass),
      absorbsPrecedingEm: 0,
    });
  }
  const lastClass = classes[end - 1];
  const endSpacing = lastClass === undefined ? null : profile.lineEndSpacing(lastClass);
  if (endSpacing !== null) {
    result.push({
      boundary: end,
      spacing: endSpacing.spacing,
      absorbsPrecedingEm: endSpacing.absorbsPrecedingEm,
    });
  }
  return result;
}

/**
 * Break the line's spaces into the indivisible amounts the line adjustment may spend.
 *
 * A line end the profile says absorbs the space before it claims that much of the preceding
 * boundary's capacity, and the two become one unit at the line-end stage — JLReq 3.8.3's third
 * stage, which is free. Whatever the preceding boundary has left over stays an opportunity of its
 * own stage, so the half em of a `、` before a line-end `・` is still spent where 3.8.3 puts it.
 */
function adjustmentUnits(
  values: readonly Opportunity[],
  adjustment: "shrink" | "stretch",
): AdjustmentUnit[] {
  const select = (spacing: PairSpacing): SpacingCapacity | undefined =>
    adjustment === "shrink" ? spacing.shrink : spacing.stretch;
  const byBoundary = new Map(values.map((value) => [value.boundary, value]));
  const absorbedEm = new Map<number, number>();
  const absorbing = new Set<number>();
  const units: AdjustmentUnit[] = [];

  // The straddling line ends first, so the boundary they draw from knows what is left of it.
  for (const { boundary, spacing, absorbsPrecedingEm } of values) {
    if (absorbsPrecedingEm <= 0) continue;
    const own = select(spacing);
    if (own === undefined) continue;
    absorbing.add(boundary);
    const preceding = byBoundary.get(boundary - 1);
    const availableEm = preceding === undefined ? 0 : (select(preceding.spacing)?.amountEm ?? 0);
    // 3.1.9 takes the two together: where the space before cannot give, neither goes.
    if (availableEm + EPSILON < absorbsPrecedingEm) continue;
    absorbedEm.set(boundary - 1, absorbsPrecedingEm);
    units.push({
      parts: [
        { boundary: boundary - 1, amountEm: absorbsPrecedingEm },
        { boundary, amountEm: own.amountEm },
      ],
      priority: own.priority,
      amountEm: absorbsPrecedingEm + own.amountEm,
      granularity: own.granularity,
    });
  }

  for (const { boundary, spacing } of values) {
    if (absorbing.has(boundary)) continue;
    const own = select(spacing);
    if (own === undefined) continue;
    const amountEm = own.amountEm - (absorbedEm.get(boundary) ?? 0);
    if (amountEm <= EPSILON) continue;
    units.push({
      parts: [{ boundary, amountEm }],
      priority: own.priority,
      amountEm,
      granularity: own.granularity,
    });
  }

  return units;
}

/**
 * Spend `amountEm` over the line's units of adjustment, stage by stage.
 *
 * Every stage of JLReq 3.8.3 and 3.8.4 is stated as 文字サイズ比で均等に — the English text of 3.8.3 a puts
 * it as "The same width reduction is applied to all spaces on the target line at the same time."
 * Within a stage the amount is therefore split in proportion to what each space can give, rather
 * than taken out of the earliest space until it runs dry. Across stages the order stays a
 * waterfall: a later stage is reached only once every stage before it is spent out. The composer
 * sets one character size, so a share of the stage's capacity is a share by character size.
 *
 * An all-or-nothing unit larger than what is still needed is skipped rather than partly spent, and
 * never revisited: `remaining` only falls, so a unit that did not fit at its own stage cannot fit
 * at a later one. One forward pass is therefore exact and no search over subsets is needed.
 */
function resolveSpacings(
  values: readonly Opportunity[],
  units: readonly AdjustmentUnit[],
  adjustment: "shrink" | "stretch",
  amountEm: number,
): Readonly<{
  spacings: ResolvedPairSpacing[];
  priorityCost: number;
  freeEm: number;
  unabsorbedEm: number;
}> {
  const usedByBoundary = new Map<number, number>();
  let remaining = amountEm;
  let priorityCost = 0;
  let freeEm = 0;

  const spend = (unit: AdjustmentUnit, fraction: number): void => {
    for (const { boundary, amountEm: partEm } of unit.parts) {
      usedByBoundary.set(boundary, (usedByBoundary.get(boundary) ?? 0) + partEm * fraction);
    }
    const spentEm = unit.amountEm * fraction;
    priorityCost += spentEm * unit.priority;
    if (unit.priority === FREE_SHRINK_PRIORITY) freeEm += spentEm;
    remaining -= spentEm;
  };

  const priorities = [...new Set(units.map(({ priority }) => priority))].sort(
    (left, right) => left - right,
  );

  for (const priority of priorities) {
    if (remaining <= EPSILON) break;
    const stage = units.filter((unit) => unit.priority === priority);

    for (const unit of stage) {
      if (unit.granularity !== "all-or-nothing") continue;
      if (unit.amountEm > remaining + EPSILON) continue;
      spend(unit, 1);
    }

    const divisible = stage.filter(({ granularity }) => granularity === "continuous");
    const stageCapacityEm = divisible.reduce((total, { amountEm: unitEm }) => total + unitEm, 0);
    if (stageCapacityEm <= EPSILON || remaining <= EPSILON) continue;
    const fraction = Math.min(remaining, stageCapacityEm) / stageCapacityEm;
    for (const unit of divisible) spend(unit, fraction);
  }

  return {
    spacings: values.map(({ boundary, spacing }) => {
      const used = usedByBoundary.get(boundary) ?? 0;
      return {
        boundary,
        kind: spacing.kind,
        naturalWidthEm: spacing.naturalWidthEm,
        widthEm:
          adjustment === "shrink" ? spacing.naturalWidthEm - used : spacing.naturalWidthEm + used,
      };
    }),
    priorityCost,
    freeEm,
    unabsorbedEm: Math.max(0, remaining),
  };
}

/**
 * The same spaces at the width the profile gives them, for a line no adjustment reaches.
 */
function naturalSpacings(values: readonly Opportunity[]): ResolvedPairSpacing[] {
  return values.map(({ boundary, spacing }) => ({
    boundary,
    kind: spacing.kind,
    naturalWidthEm: spacing.naturalWidthEm,
    widthEm: spacing.naturalWidthEm,
  }));
}

function candidate(
  atoms: readonly ParagraphAtom[],
  classes: readonly JapaneseCharacterClass[],
  start: number,
  end: number,
  lineLengthEm: number,
  profile: JapaneseTypesettingProfile,
): Candidate {
  const contentStart = skipSourceGaps(atoms, start);
  const suppressedIndexes = Array.from(
    { length: contentStart - start },
    (_, index) => start + index,
  );
  // A line that starts at the first atom of the paragraph is a 改行行頭; every other line is a line the
  // composer turned over, and JLReq 3.1.5 gives the two different white before an opening bracket.
  const pairValues = opportunities(
    atoms,
    classes,
    contentStart,
    end,
    profile,
    start === 0 ? "paragraph-start" : "turned-over",
  );
  const naturalSizeEm =
    atoms.slice(contentStart, end).reduce((total, atom) => total + atom.boxAdvanceEm, 0) +
    pairValues.reduce((total, value) => total + value.spacing.naturalWidthEm, 0);
  const terminal = skipSourceGaps(atoms, end) === atoms.length;
  const shrinkUnits = adjustmentUnits(pairValues, "shrink");
  const stretchUnits = adjustmentUnits(pairValues, "stretch");
  // Summed over the units rather than over the raw capacities: the quarter em before a line-end
  // middle dot carries the mid-line stage in the pair table but belongs to a priority-0 unit, so
  // reading the table directly would count it as capacity the reader can see.
  const shrinkCapacity = shrinkUnits.reduce((total, { amountEm }) => total + amountEm, 0);
  const freeShrinkCapacity = shrinkUnits.reduce(
    (total, { priority, amountEm }) => total + (priority === FREE_SHRINK_PRIORITY ? amountEm : 0),
    0,
  );
  const stretchCapacity = stretchUnits.reduce((total, { amountEm }) => total + amountEm, 0);
  const overflow = naturalSizeEm - lineLengthEm;
  const underflow = lineLengthEm - naturalSizeEm;
  const lastVisible = previousVisible(atoms, end);
  const lastClass = lastVisible === undefined ? undefined : classes[lastVisible];
  const lastAdvance = lastVisible === undefined ? 0 : (atoms[lastVisible]?.boxAdvanceEm ?? 0);
  const trailingSpacing =
    pairValues.find(({ boundary }) => boundary === end)?.spacing.naturalWidthEm ?? 0;

  if (terminal && overflow <= EPSILON) {
    return {
      start,
      contentStart,
      end,
      suppressedIndexes,
      pairSpacings: naturalSpacings(pairValues),
      inlineSizeEm: naturalSizeEm,
      break: { kind: "paragraph-end" },
      hangingIndex: null,
      deformationRatio: 0,
      priorityCost: 0,
    };
  }

  if (Math.abs(overflow) <= EPSILON) {
    return {
      start,
      contentStart,
      end,
      suppressedIndexes,
      pairSpacings: naturalSpacings(pairValues),
      inlineSizeEm: naturalSizeEm,
      break: { kind: "natural" },
      hangingIndex: null,
      deformationRatio: 0,
      priorityCost: 0,
    };
  }

  // `shrinkCapacity` is only an upper bound: an all-or-nothing unit larger than the overflow is
  // skipped rather than partly spent (JLReq 3.1.9), so a line inside the bound may still be unable
  // to give the whole amount. What it could not absorb decides whether this is a shrunk line at all.
  const shrunk =
    overflow > 0 && overflow <= shrinkCapacity + EPSILON
      ? resolveSpacings(pairValues, shrinkUnits, "shrink", overflow)
      : null;

  if (shrunk !== null && shrunk.unabsorbedEm <= EPSILON) {
    // No visible capacity is all-or-nothing in this profile, so every em outside the free stage can
    // still be spent in part and the denominator holds.
    const chargeableCapacity = shrinkCapacity - freeShrinkCapacity;
    const chargeableShrink = Math.max(0, overflow - shrunk.freeEm);
    return {
      start,
      contentStart,
      end,
      suppressedIndexes,
      pairSpacings: shrunk.spacings,
      inlineSizeEm: lineLengthEm,
      break: { kind: "shrunk" },
      hangingIndex: null,
      deformationRatio: chargeableCapacity <= EPSILON ? 0 : chargeableShrink / chargeableCapacity,
      priorityCost: shrunk.priorityCost,
    };
  }

  if (
    !terminal &&
    overflow > 0 &&
    lastVisible !== undefined &&
    lastClass !== undefined &&
    profile.canHang(lastClass) &&
    naturalSizeEm - lastAdvance - trailingSpacing <= lineLengthEm + EPSILON
  ) {
    return {
      start,
      contentStart,
      end,
      suppressedIndexes,
      pairSpacings: naturalSpacings(pairValues).filter(({ boundary }) => boundary !== end),
      inlineSizeEm: naturalSizeEm - lastAdvance - trailingSpacing,
      break: { kind: "hanging" },
      hangingIndex: lastVisible,
      deformationRatio: overflow / Math.max(lastAdvance, EPSILON),
      priorityCost: 0,
    };
  }

  // Nothing this profile expands is all-or-nothing, so the remainder is always zero here. The guard
  // is what keeps `inlineSizeEm: lineLengthEm` honest the day one is.
  const stretched =
    !terminal && underflow > EPSILON && underflow <= stretchCapacity + EPSILON
      ? resolveSpacings(pairValues, stretchUnits, "stretch", underflow)
      : null;

  if (stretched !== null && stretched.unabsorbedEm <= EPSILON) {
    return {
      start,
      contentStart,
      end,
      suppressedIndexes,
      pairSpacings: stretched.spacings,
      inlineSizeEm: lineLengthEm,
      break: { kind: "stretched" },
      hangingIndex: null,
      deformationRatio: stretchCapacity === 0 ? 0 : underflow / stretchCapacity,
      priorityCost: stretched.priorityCost,
    };
  }

  return {
    start,
    contentStart,
    end,
    suppressedIndexes,
    pairSpacings: naturalSpacings(pairValues),
    inlineSizeEm: naturalSizeEm,
    break: { kind: "forced" },
    hangingIndex: null,
    deformationRatio: Math.abs(naturalSizeEm - lineLengthEm) / Math.max(lineLengthEm, EPSILON),
    priorityCost: 0,
  };
}

function scoreFor(
  line: Candidate,
  previousFitness: number,
): Readonly<{ score: Score; fitness: number }> {
  const mode = line.break.kind;
  const fitness = Math.min(3, Math.floor(line.deformationRatio * 4));
  const transition = Math.abs(previousFitness - fitness) > 1 ? 1 : 0;
  const modeCounts = {
    forced: mode === "forced" ? 1 : 0,
    stretched: mode === "stretched" ? 1 : 0,
    hanging: mode === "hanging" ? 1 : 0,
    // `priorityCost` is the sum of `used * priority`, so a shrunk line spending
    // only free capacity costs nothing and reads as tightly as a natural one.
    shrunk: mode === "shrunk" && line.priorityCost > EPSILON ? 1 : 0,
  };
  return {
    score: [
      modeCounts.forced,
      modeCounts.stretched,
      modeCounts.hanging,
      modeCounts.shrunk,
      line.priorityCost,
      line.deformationRatio ** 3,
      transition,
    ],
    fitness,
  };
}

function addScore(left: Score, right: Score): Score {
  return [
    left[0] + right[0],
    left[1] + right[1],
    left[2] + right[2],
    left[3] + right[3],
    left[4] + right[4],
    left[5] + right[5],
    left[6] + right[6],
  ];
}

function compareBreaks(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (right[index] ?? 0) - (left[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function isBetter(candidateState: State, current: State | undefined): boolean {
  if (current === undefined) return true;
  for (let index = 0; index < candidateState.score.length; index += 1) {
    const difference = (candidateState.score[index] ?? 0) - (current.score[index] ?? 0);
    if (Math.abs(difference) > EPSILON) return difference < 0;
  }
  return compareBreaks(candidateState.breaks, current.breaks) < 0;
}

export function layoutParagraph(
  atoms: readonly ParagraphAtom[],
  lineLengthEm: number,
  profile: JapaneseTypesettingProfile,
  boundaryAllowed: (leftIndex: number, rightIndex: number) => boolean,
): ParagraphLinePlan[] {
  if (atoms.length === 0) return [];
  const classes = atoms.map(({ characterClass }) => characterClass);
  const states = new Map<number, Map<number, State>>([
    [
      0,
      new Map([
        [
          0,
          {
            score: [0, 0, 0, 0, 0, 0, 0],
            fitness: 0,
            previous: null,
            line: null,
            breaks: [],
          },
        ],
      ]),
    ],
  ]);

  for (let start = 0; start < atoms.length; start += 1) {
    const activeStates = states.get(start);
    if (activeStates === undefined) continue;
    const contentStart = skipSourceGaps(atoms, start);
    if (contentStart === atoms.length) {
      const terminalStates = states.get(atoms.length) ?? new Map<number, State>();
      for (const state of activeStates.values()) {
        const current = terminalStates.get(state.fitness);
        if (isBetter(state, current)) terminalStates.set(state.fitness, state);
      }
      states.set(atoms.length, terminalStates);
      continue;
    }

    for (const state of activeStates.values()) {
      for (let end = contentStart + 1; end <= atoms.length; end += 1) {
        const right = skipSourceGaps(atoms, end);
        const left = previousVisible(atoms, end);
        if (atoms[end - 1]?.sourceGap === true) continue;
        if (
          end < atoms.length &&
          right < atoms.length &&
          (left === undefined || !boundaryAllowed(left, right))
        ) {
          continue;
        }

        const line = candidate(atoms, classes, start, end, lineLengthEm, profile);
        if (
          line.break.kind === "forced" &&
          line.inlineSizeEm > lineLengthEm + EPSILON &&
          Array.from(
            { length: end - contentStart - 1 },
            (_, index) => contentStart + index + 1,
          ).some((boundary) => boundaryAllowed(boundary - 1, boundary))
        ) {
          if (line.inlineSizeEm > lineLengthEm * 2 && end > contentStart + 1) break;
          continue;
        }
        const lineScore = scoreFor(line, state.fitness);
        const nextState: State = {
          score: addScore(state.score, lineScore.score),
          fitness: lineScore.fitness,
          previous: { index: start, fitness: state.fitness },
          line,
          breaks: [...state.breaks, end],
        };
        const statesAtEnd = states.get(end) ?? new Map<number, State>();
        if (isBetter(nextState, statesAtEnd.get(nextState.fitness))) {
          statesAtEnd.set(nextState.fitness, nextState);
          states.set(end, statesAtEnd);
        }

        if (
          line.inlineSizeEm > lineLengthEm * 2 &&
          line.break.kind === "forced" &&
          end > contentStart + 1
        ) {
          break;
        }
      }
    }
  }

  const terminal = [...(states.get(atoms.length)?.values() ?? [])].reduce<State | undefined>(
    (best, state) => (isBetter(state, best) ? state : best),
    undefined,
  );
  if (terminal === undefined) return [];
  const lines: ParagraphLinePlan[] = [];
  let cursor: State | undefined = terminal;
  while (cursor?.line !== null && cursor?.line !== undefined) {
    lines.push(cursor.line);
    cursor =
      cursor.previous === null
        ? undefined
        : states.get(cursor.previous.index)?.get(cursor.previous.fitness);
  }
  lines.reverse();
  const last = lines.at(-1);
  if (last !== undefined && last.end < atoms.length) {
    lines[lines.length - 1] = {
      ...last,
      suppressedIndexes: [
        ...last.suppressedIndexes,
        ...Array.from({ length: atoms.length - last.end }, (_, index) => last.end + index),
      ],
    };
  }
  return lines;
}
