import { eastAsianWidth } from "get-east-asian-width";
import * as v from "valibot";

import type { FontPresetId } from "../appearance/font-preset-id";
import { readonlyObject } from "../internal/schema";
import { graphemeSegmenter } from "../internal/segmenter";
import type { VerticalTextPresentation } from "./vertical-text-presentation";

type InlineMeasureContext = Readonly<{
  text: string;
  fontPreset: FontPresetId;
  writingMode: "vertical-rl";
}>;

export type InlineMeasureRequest = InlineMeasureContext &
  (
    | Readonly<{ role: "base"; presentation: VerticalTextPresentation["kind"] }>
    | Readonly<{ role: "ruby" }>
  );

const InlineMeasurementSchema = readonlyObject({
  advanceEm: v.pipe(v.number(), v.finite(), v.minValue(0)),
});

export type InlineMeasurement = v.InferOutput<typeof InlineMeasurementSchema>;

export const InlineMeasurement = { schema: InlineMeasurementSchema } as const;

export type InlineMeasurer = (request: InlineMeasureRequest) => InlineMeasurement;

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
export const logicalInlineMeasurer: InlineMeasurer = (request) => {
  const { text } = request;
  const width = [...graphemeSegmenter.segment(text)].reduce(
    (total, { segment }) => total + graphemeWidth(segment),
    0,
  );

  if (request.role === "ruby") return { advanceEm: width / 2 };
  return {
    advanceEm:
      request.presentation === "upright" ? [...graphemeSegmenter.segment(text)].length : width,
  };
};
