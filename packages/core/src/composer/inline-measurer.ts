import { eastAsianWidth } from "get-east-asian-width";

import type { FontPresetId } from "../appearance/font-preset-id";
import { graphemeSegmenter } from "../internal/segmenter";

export type InlineMeasureRequest = Readonly<{
  text: string;
  role: "base" | "ruby";
  fontPreset: FontPresetId;
  writingMode: "vertical-rl";
}>;

export type InlineMeasurer = (request: InlineMeasureRequest) => number;

function graphemeWidth(grapheme: string): number {
  let width = 1;
  for (const character of grapheme) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined) {
      width = Math.max(width, eastAsianWidth(codePoint, { ambiguousAsWide: true }));
    }
  }
  return width / 2;
}

/**
 * Deterministic Japanese-context measurement in logical em units.
 */
export const logicalInlineMeasurer: InlineMeasurer = ({ text, role }) => {
  const width = [...graphemeSegmenter.segment(text)].reduce(
    (total, { segment }) => total + graphemeWidth(segment),
    0,
  );

  return role === "ruby" ? width / 2 : width;
};
