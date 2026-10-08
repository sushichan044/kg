import type { CandidateLine } from "./candidate-line";

const EPSILON = 1e-9;
export type Score = readonly [number, number, number, number, number, number, number];
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
    // `deformationCost` is the sum of `used * costPerEm`, so a shrunk line spending
    // only free capacity costs nothing and reads as tightly as a natural one.
    shrunk: mode === "shrunk" && line.deformationCost > EPSILON ? 1 : 0,
  };
  return {
    score: [
      modeCounts.forced,
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
  ];
}

export const defaultParagraphEvaluation: ParagraphEvaluation = { scoreFor };
