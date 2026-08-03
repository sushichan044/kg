import * as v from "valibot";

const RANGE = { min: 6, max: 24, step: 0.5 } as const;

const FontSizePtSchema = v.pipe(
  v.number(),
  v.finite(),
  v.minValue(RANGE.min),
  v.maxValue(RANGE.max),
  v.multipleOf(RANGE.step),
);

/**
 * A manuscript cell pitch in points, constrained to the steps the settings UI can express.
 */
export type FontSizePt = v.InferOutput<typeof FontSizePtSchema>;

export const FontSizePt = {
  schema: FontSizePtSchema,
  range: RANGE,

  is: (value: unknown): value is FontSizePt => v.is(FontSizePtSchema, value),
} as const;
