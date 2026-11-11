import * as v from "valibot";

import { TextRange } from "../range/text-range";

const MeasurementTextRangeSchema = v.pipe(TextRange.schema, v.brand("MeasurementTextRange"));

/**
 * リクエスト内でだけ有効な、終端を含まない UTF-16 オフセット。原稿上のオフセットではない。
 */
export type MeasurementTextRange = v.InferOutput<typeof MeasurementTextRangeSchema>;

export const MeasurementTextRange = {
  schema: MeasurementTextRangeSchema,
  of: (range: Readonly<{ start: number; end: number }>): MeasurementTextRange =>
    v.parse(MeasurementTextRangeSchema, range),
} as const;
