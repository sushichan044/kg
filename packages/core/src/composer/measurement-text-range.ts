import * as v from "valibot";

import { TextRange } from "../range/text-range";

const MeasurementTextRangeSchema = v.pipe(TextRange.schema, v.brand("MeasurementTextRange"));

/**
 * Request-local, end-exclusive UTF-16 offsets, never manuscript offsets.
 */
export type MeasurementTextRange = v.InferOutput<typeof MeasurementTextRangeSchema>;

export const MeasurementTextRange = {
  schema: MeasurementTextRangeSchema,
  of: (range: Readonly<{ start: number; end: number }>): MeasurementTextRange =>
    v.parse(MeasurementTextRangeSchema, range),
} as const;
