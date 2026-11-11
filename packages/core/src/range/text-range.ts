import * as v from "valibot";

import { nonNegativeInteger, readonlyObject } from "../internal/schema";

const TextRangeSchema = v.pipe(
  readonlyObject({ start: nonNegativeInteger(), end: nonNegativeInteger() }),
  v.check(({ start, end }) => end >= start, "range end must not precede its start"),
);

/**
 * 半開区間 `[start, end)`。単位は、これを包むブランド付きの範囲型によって決まる。
 */
export type TextRange = v.InferOutput<typeof TextRangeSchema>;

export const TextRange = { schema: TextRangeSchema } as const;
