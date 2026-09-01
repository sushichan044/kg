import * as v from "valibot";

import { readonlyObject } from "../internal/schema";

const InlineSpanSchema = readonlyObject({
  offsetEm: v.pipe(v.number(), v.finite()),
  advanceEm: v.pipe(v.number(), v.finite(), v.minValue(0)),
});

export type InlineSpan = v.InferOutput<typeof InlineSpanSchema>;

export const InlineSpan = { schema: InlineSpanSchema } as const;
