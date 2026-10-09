import type { CandidateLine } from "./candidate-line";
import { addScore, defaultParagraphEvaluation } from "./paragraph-evaluation";
import type { ParagraphEvaluation, Score } from "./paragraph-evaluation";
import type { ParagraphLinePlan } from "./paragraph-line-plan";

const EPSILON = 1e-9;

export type ParagraphElement = Readonly<{ boxAdvanceEm: number; sourceGap: boolean }>;

type State = Readonly<{
  score: Score;
  fitness: number;
  previous: Readonly<{ index: number; fitness: number }> | null;
  line: CandidateLine | null;
}>;

function skipSourceGaps(atoms: readonly ParagraphElement[], start: number): number {
  let cursor = start;
  while (atoms[cursor]?.sourceGap === true) cursor += 1;
  return cursor;
}

function previousVisible(atoms: readonly ParagraphElement[], end: number): number | undefined {
  for (let index = end - 1; index >= 0; index -= 1) {
    if (atoms[index]?.sourceGap === false) return index;
  }
  return undefined;
}

/**
 * Whether a shorter line ending somewhere inside `(contentStart, end)` was ever an option — checked
 * as a plain short-circuiting scan rather than building the boundary list first, since this runs
 * once per over-long candidate the optimizer considers.
 */
function hasEarlierBoundary(
  boundaryAllowed: (leftIndex: number, rightIndex: number) => boolean,
  contentStart: number,
  end: number,
): boolean {
  for (let boundary = contentStart + 1; boundary < end; boundary += 1) {
    if (boundaryAllowed(boundary - 1, boundary)) return true;
  }
  return false;
}

/**
 * The line-end offsets a state's path took, earliest first. Rebuilt on demand by walking `previous`
 * rather than carried on every `State`: every candidate line attempted would otherwise pay for a
 * copy of its whole path, when `isBetter` only ever reads it on the exact-score tie this comparison
 * breaks — for `boundaryAllowed` predicates permissive enough to fully saturate the optimizer's
 * search window, ties are rare enough that this deferred cost is negligible.
 */
function breaksOf(state: State, states: ReadonlyMap<number, ReadonlyMap<number, State>>): number[] {
  const result: number[] = [];
  let cursor: State | undefined = state;
  while (cursor?.line !== null && cursor?.line !== undefined) {
    result.push(cursor.line.end);
    cursor =
      cursor.previous === null
        ? undefined
        : states.get(cursor.previous.index)?.get(cursor.previous.fitness);
  }
  return result.reverse();
}

function compareBreaks(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (right[index] ?? 0) - (left[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function isBetter(
  candidateState: State,
  current: State | undefined,
  states: ReadonlyMap<number, ReadonlyMap<number, State>>,
): boolean {
  if (current === undefined) return true;
  for (let index = 0; index < candidateState.score.length; index += 1) {
    const difference = (candidateState.score[index] ?? 0) - (current.score[index] ?? 0);
    if (Math.abs(difference) > EPSILON) return difference < 0;
  }
  return compareBreaks(breaksOf(candidateState, states), breaksOf(current, states)) < 0;
}

export function layoutParagraph(
  atoms: readonly ParagraphElement[],
  lineLengthEm: number,
  resolveCandidate: (start: number, end: number) => CandidateLine | undefined,
  boundaryAllowed: (leftIndex: number, rightIndex: number) => boolean,
  evaluation: ParagraphEvaluation = defaultParagraphEvaluation,
): ParagraphLinePlan[] {
  if (atoms.length === 0) return [];
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
        if (isBetter(state, current, states)) terminalStates.set(state.fitness, state);
      }
      states.set(atoms.length, terminalStates);
      continue;
    }

    // Geometry depends on the line interval, not the preceding line's fitness. Retain only
    // this start's bounded search window rather than a graph of every paragraph candidate.
    const candidatesByEnd = new Map<number, CandidateLine | undefined>();
    for (const state of activeStates.values()) {
      let minimumSizeEm = 0;
      for (let end = contentStart + 1; end <= atoms.length; end += 1) {
        minimumSizeEm += atoms[end - 1]?.boxAdvanceEm ?? 0;
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

        let line = candidatesByEnd.get(end);
        if (!candidatesByEnd.has(end)) {
          line = resolveCandidate(start, end);
          candidatesByEnd.set(end, line);
        }
        if (line === undefined) {
          if (minimumSizeEm > lineLengthEm * 2 && end > contentStart + 1) break;
          continue;
        }
        if (
          line.break.kind === "forced" &&
          line.inlineSizeEm > lineLengthEm + EPSILON &&
          hasEarlierBoundary(boundaryAllowed, contentStart, end)
        ) {
          if (line.inlineSizeEm > lineLengthEm * 2 && end > contentStart + 1) break;
          continue;
        }
        const lineScore = evaluation.scoreFor(line, state.fitness);
        const nextState: State = {
          score: addScore(state.score, lineScore.score),
          fitness: lineScore.fitness,
          previous: { index: start, fitness: state.fitness },
          line,
        };
        const statesAtEnd = states.get(end) ?? new Map<number, State>();
        if (isBetter(nextState, statesAtEnd.get(nextState.fitness), states)) {
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
    (best, state) => (isBetter(state, best, states) ? state : best),
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
