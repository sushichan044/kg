import { eastAsianWidth } from "get-east-asian-width";

import { DIVIDING_PUNCTUATION } from "../internal/japanese-punctuation";
import { graphemeSegmenter } from "../internal/segmenter";
import type { MeasurementRequest } from "./measurement-request";
import type { RunMeasurement } from "./run-measurement";

export type RunMeasurer = (request: MeasurementRequest) => RunMeasurement;

function graphemeWidth(grapheme: string): number {
  let width = 1;
  for (const character of grapheme) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined) {
      const characterWidth = DIVIDING_PUNCTUATION.includes(character)
        ? 2
        : eastAsianWidth(codePoint, { ambiguousAsWide: true });
      width = Math.max(width, characterWidth);
    }
  }
  return width / 2;
}

/**
 * Deterministic DOM-independent metrics. Aggregate width does not imply a shared cluster.
 */
export const logicalRunMeasurer: RunMeasurer = (request) => {
  const segments = [...graphemeSegmenter.segment(request.text)];
  const advance =
    request.kind === "base" && request.presentation === "upright"
      ? segments.length
      : segments.reduce((total, { segment }) => total + graphemeWidth(segment), 0);
  return { kind: "advance", advanceEm: advance * request.scale };
};
