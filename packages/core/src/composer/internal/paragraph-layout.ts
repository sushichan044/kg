import type { CandidateLine } from "./candidate-line";
import { addScore, defaultParagraphEvaluation } from "./paragraph-evaluation";
import type { ParagraphEvaluation, Score } from "./paragraph-evaluation";
import type { ParagraphLinePlan } from "./paragraph-line-plan";

const EPSILON = 1e-9;

export type ParagraphElement = Readonly<{ boxAdvanceEm: number; sourceGap: boolean }>;

type State = Readonly<{
  score: Score;
  fitness: number;
  cursor: number;
  previous: Readonly<{ index: number; key: string }> | null;
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
 * `(contentStart, end)` の内側のどこかで終わる短い行が選択肢になりえたかどうか。
 * 最適化処理が検討する長すぎる候補ごとに1回実行されるので、先に境界のリストを作らず、
 * 単純な短絡評価の走査で確かめる。
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
 * 状態の経路がたどった行末のオフセットを、先頭から順に並べたもの。すべての `State` に持たせず、
 * 必要になった時点で `previous` をたどって組み立てる。
 * そうしないと、試した候補行ごとに経路全体のコピーの費用がかかる。`isBetter` がこれを読むのは、
 * この比較で決着をつけるスコアの完全な同点のときだけだ。`boundaryAllowed` の述語が緩く、
 * 最適化処理の探索範囲を埋め尽くす場合でも、同点はまれなので、この遅延による費用は無視できる。
 */
function breaksOf(state: State, states: ReadonlyMap<number, ReadonlyMap<string, State>>): number[] {
  const result: number[] = [];
  let cursor: State | undefined = state;
  while (cursor?.line !== null && cursor?.line !== undefined) {
    result.push(cursor.line.end);
    cursor =
      cursor.previous === null
        ? undefined
        : states.get(cursor.previous.index)?.get(cursor.previous.key);
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
  states: ReadonlyMap<number, ReadonlyMap<string, State>>,
): boolean {
  if (current === undefined) return true;
  for (let index = 0; index < candidateState.score.length; index += 1) {
    const candidate = candidateState.score[index] ?? 0;
    const existing = current.score[index] ?? 0;
    // 3乗の空ける処理のコストを全角単位で比べ、許容誤差が小さな空け量を隠さないようにする。
    const difference =
      index === 1 ? Math.cbrt(candidate) - Math.cbrt(existing) : candidate - existing;
    if (Math.abs(difference) > EPSILON) return difference < 0;
  }
  return compareBreaks(breaksOf(candidateState, states), breaksOf(current, states)) < 0;
}

export function layoutParagraph(
  atoms: readonly ParagraphElement[],
  lineLengthEm: number,
  resolveCandidate: (start: number, end: number, cursor: number) => CandidateLine | undefined,
  boundaryAllowed: (leftIndex: number, rightIndex: number) => boolean,
  evaluation: ParagraphEvaluation = defaultParagraphEvaluation,
): ParagraphLinePlan[] {
  if (atoms.length === 0) return [];
  const stateKey = (cursor: number, fitness: number) => `${cursor}:${fitness}`;
  const states = new Map<number, Map<string, State>>([
    [
      0,
      new Map([
        [
          stateKey(0, 0),
          {
            score: [0, 0, 0, 0, 0, 0, 0, 0],
            fitness: 0,
            cursor: 0,
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
      const terminalStates = states.get(atoms.length) ?? new Map<string, State>();
      for (const state of activeStates.values()) {
        const key = stateKey(state.cursor, state.fitness);
        const current = terminalStates.get(key);
        if (isBetter(state, current, states)) terminalStates.set(key, state);
      }
      states.set(atoms.length, terminalStates);
      continue;
    }

    // 続く行があるかどうかで幾何は変わりうるが、収まり具合は変わらない。
    // 段落全体の密なグラフではなく、拒否した候補も含めて、この開始位置の探索範囲だけを保持する。
    const candidatesByEnd = new Map<string, CandidateLine | undefined>();
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

        const candidateKey = `${end}:${state.cursor}`;
        let line = candidatesByEnd.get(candidateKey);
        if (!candidatesByEnd.has(candidateKey)) {
          line = resolveCandidate(start, end, state.cursor);
          candidatesByEnd.set(candidateKey, line);
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
          cursor: line.nextCursor ?? 0,
          previous: { index: start, key: stateKey(state.cursor, state.fitness) },
          line,
        };
        const statesAtEnd = states.get(end) ?? new Map<string, State>();
        const nextKey = stateKey(nextState.cursor, nextState.fitness);
        if (isBetter(nextState, statesAtEnd.get(nextKey), states)) {
          statesAtEnd.set(nextKey, nextState);
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
        : states.get(cursor.previous.index)?.get(cursor.previous.key);
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
