import * as v from "valibot";

const FontSizeQSchema = v.pipe(v.number(), v.finite(), v.minValue(Number.MIN_VALUE));

/**
 * 本文のフォントサイズを級数（Q）で表す。1Q = 0.25mm。
 */
export type FontSizeQ = v.InferOutput<typeof FontSizeQSchema>;

export const FontSizeQ = {
  schema: FontSizeQSchema,
  is: (value: unknown): value is FontSizeQ => v.is(FontSizeQSchema, value),
} as const;
