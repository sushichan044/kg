import type { CandidateLine } from "./candidate-line";

const EPSILON = 1e-9;
export type Score = readonly [number, number, number, number, number, number, number, number];
export type ParagraphEvaluation = Readonly<{
  scoreFor: (
    line: CandidateLine,
    previousFitness: number,
  ) => Readonly<{ score: Score; fitness: number }>;
}>;

function scoreFor(
  line: CandidateLine,
  previousFitness: number,
): Readonly<{ score: Score; fitness: number }> {
  const mode = line.break.kind;
  const fitness = Math.min(3, Math.floor(line.deformationRatio * 4));
  const transition = Math.abs(previousFitness - fitness) > 1 ? 1 : 0;
  const modeCounts = {
    forced: mode === "forced" ? 1 : 0,
    stretched: mode === "stretched" ? 1 : 0,
    hanging: mode === "hanging" ? 1 : 0,
    // `deformationCost` は `used * costPerEm` の合計なので、
    // コストのかからない調整可能量だけを使って詰めた行はコストが0になり、
    // 自然な行と同じ詰まり具合に見える。
    shrunk: mode === "shrunk" && line.deformationCost > EPSILON ? 1 : 0,
  };
  return {
    score: [
      modeCounts.forced,
      // JLReq 3.8.4 の最終段階の空ける処理は、上限のある段階の後に行う。3乗のバッドネスによって、
      // まず上限内に収まるレイアウトを優先し、避けられない超過分は段落全体に分散させる。
      line.finalExpansionBadness,
      modeCounts.stretched,
      modeCounts.hanging,
      modeCounts.shrunk,
      line.deformationCost,
      line.deformationRatio ** 3,
      transition,
    ],
    fitness,
  };
}

export function addScore(left: Score, right: Score): Score {
  return [
    left[0] + right[0],
    left[1] + right[1],
    left[2] + right[2],
    left[3] + right[3],
    left[4] + right[4],
    left[5] + right[5],
    left[6] + right[6],
    left[7] + right[7],
  ];
}

export const defaultParagraphEvaluation: ParagraphEvaluation = { scoreFor };
