import * as v from "valibot";

const FontSizeQSchema = v.pipe(v.number(), v.finite(), v.minValue(Number.MIN_VALUE));

/**
 * A body font size in quarter millimetres: 1Q = 0.25mm.
 */
export type FontSizeQ = v.InferOutput<typeof FontSizeQSchema>;

export const FontSizeQ = {
  schema: FontSizeQSchema,
  is: (value: unknown): value is FontSizeQ => v.is(FontSizeQSchema, value),
} as const;
