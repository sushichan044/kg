import type { LineBreakResult } from "../line-break-result";
import type {
  JapaneseCharacterClass,
  JapaneseTypesettingProfile,
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
): Opportunity[] {
  const result: Opportunity[] = [];
  const firstClass = classes[start];
  const startSpacing = firstClass === undefined ? null : profile.lineStartSpacing(firstClass);
  if (startSpacing !== null) result.push({ boundary: start, spacing: startSpacing });
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
    result.push({ boundary: right, spacing: profile.pairSpacing(leftClass, rightClass) });
  }
  const lastClass = classes[end - 1];
  const endSpacing = lastClass === undefined ? null : profile.lineEndSpacing(lastClass);
  if (endSpacing !== null) result.push({ boundary: end, spacing: endSpacing });
  return result;
}

function capacity(
  values: readonly Opportunity[],
  select: (spacing: PairSpacing) => SpacingCapacity | undefined,
): number {
  return values.reduce(
    (total, opportunity) => total + (select(opportunity.spacing)?.amountEm ?? 0),
    0,
  );
}

function resolveSpacings(
  values: readonly Opportunity[],
  adjustment: "natural" | "shrink" | "stretch",
  amountEm: number,
): Readonly<{ spacings: ResolvedPairSpacing[]; priorityCost: number }> {
  const remainingByBoundary = new Map<number, number>();
  let remaining = amountEm;
  let priorityCost = 0;
  const capacities = values
    .flatMap((opportunity) => {
      const selected =
        adjustment === "shrink" ? opportunity.spacing.shrink : opportunity.spacing.stretch;
      return selected === undefined ? [] : [{ ...opportunity, capacity: selected }];
    })
    .sort(
      (left, right) =>
        left.capacity.priority - right.capacity.priority || left.boundary - right.boundary,
    );

  for (const opportunity of capacities) {
    if (remaining <= EPSILON) break;
    const used = Math.min(remaining, opportunity.capacity.amountEm);
    remainingByBoundary.set(opportunity.boundary, used);
    priorityCost += used * opportunity.capacity.priority;
    remaining -= used;
  }

  return {
    spacings: values.map(({ boundary, spacing }) => {
      const used = remainingByBoundary.get(boundary) ?? 0;
      return {
        boundary,
        kind: spacing.kind,
        naturalWidthEm: spacing.naturalWidthEm,
        widthEm:
          adjustment === "shrink" ? spacing.naturalWidthEm - used : spacing.naturalWidthEm + used,
      };
    }),
    priorityCost,
  };
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
  const pairValues = opportunities(atoms, classes, contentStart, end, profile);
  const naturalSizeEm =
    atoms.slice(contentStart, end).reduce((total, atom) => total + atom.boxAdvanceEm, 0) +
    pairValues.reduce((total, value) => total + value.spacing.naturalWidthEm, 0);
  const terminal = skipSourceGaps(atoms, end) === atoms.length;
  const shrinkCapacity = capacity(pairValues, ({ shrink }) => shrink);
  const freeShrinkCapacity = capacity(pairValues, ({ shrink }) =>
    shrink?.priority === FREE_SHRINK_PRIORITY ? shrink : undefined,
  );
  const stretchCapacity = capacity(pairValues, ({ stretch }) => stretch);
  const overflow = naturalSizeEm - lineLengthEm;
  const underflow = lineLengthEm - naturalSizeEm;
  const lastVisible = previousVisible(atoms, end);
  const lastClass = lastVisible === undefined ? undefined : classes[lastVisible];
  const lastAdvance = lastVisible === undefined ? 0 : (atoms[lastVisible]?.boxAdvanceEm ?? 0);
  const trailingSpacing =
    pairValues.find(({ boundary }) => boundary === end)?.spacing.naturalWidthEm ?? 0;

  if (terminal && overflow <= EPSILON) {
    const resolved = resolveSpacings(pairValues, "natural", 0);
    return {
      start,
      contentStart,
      end,
      suppressedIndexes,
      pairSpacings: resolved.spacings,
      inlineSizeEm: naturalSizeEm,
      break: { kind: "paragraph-end" },
      hangingIndex: null,
      deformationRatio: 0,
      priorityCost: 0,
    };
  }

  if (Math.abs(overflow) <= EPSILON) {
    const resolved = resolveSpacings(pairValues, "natural", 0);
    return {
      start,
      contentStart,
      end,
      suppressedIndexes,
      pairSpacings: resolved.spacings,
      inlineSizeEm: naturalSizeEm,
      break: { kind: "natural" },
      hangingIndex: null,
      deformationRatio: 0,
      priorityCost: 0,
    };
  }

  if (overflow > 0 && overflow <= shrinkCapacity + EPSILON) {
    const resolved = resolveSpacings(pairValues, "shrink", overflow);
    const chargeableCapacity = shrinkCapacity - freeShrinkCapacity;
    const chargeableShrink = Math.max(0, overflow - freeShrinkCapacity);
    return {
      start,
      contentStart,
      end,
      suppressedIndexes,
      pairSpacings: resolved.spacings,
      inlineSizeEm: lineLengthEm,
      break: { kind: "shrunk" },
      hangingIndex: null,
      deformationRatio: chargeableCapacity <= EPSILON ? 0 : chargeableShrink / chargeableCapacity,
      priorityCost: resolved.priorityCost,
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
    const resolved = resolveSpacings(pairValues, "natural", 0);
    return {
      start,
      contentStart,
      end,
      suppressedIndexes,
      pairSpacings: resolved.spacings.filter(({ boundary }) => boundary !== end),
      inlineSizeEm: naturalSizeEm - lastAdvance - trailingSpacing,
      break: { kind: "hanging" },
      hangingIndex: lastVisible,
      deformationRatio: overflow / Math.max(lastAdvance, EPSILON),
      priorityCost: 0,
    };
  }

  if (!terminal && underflow > EPSILON && underflow <= stretchCapacity + EPSILON) {
    const resolved = resolveSpacings(pairValues, "stretch", underflow);
    return {
      start,
      contentStart,
      end,
      suppressedIndexes,
      pairSpacings: resolved.spacings,
      inlineSizeEm: lineLengthEm,
      break: { kind: "stretched" },
      hangingIndex: null,
      deformationRatio: stretchCapacity === 0 ? 0 : underflow / stretchCapacity,
      priorityCost: resolved.priorityCost,
    };
  }

  const resolved = resolveSpacings(pairValues, "natural", 0);
  return {
    start,
    contentStart,
    end,
    suppressedIndexes,
    pairSpacings: resolved.spacings,
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
