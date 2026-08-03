import * as v from "valibot";

import { nonNegativeInteger, readonlyObject } from "../internal/schema";

const TextRangeSchema = v.pipe(
  readonlyObject({ start: nonNegativeInteger(), end: nonNegativeInteger() }),
  v.check(({ start, end }) => end >= start, "range end must not precede its start"),
);

/**
 * A half-open `[start, end)` interval. The unit is fixed by whichever branded range wraps it.
 */
export type TextRange = v.InferOutput<typeof TextRangeSchema>;

export const TextRange = { schema: TextRangeSchema } as const;
