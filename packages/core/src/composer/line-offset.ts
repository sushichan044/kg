import type * as v from "valibot";

import { nonNegativeInteger, readonlyObject } from "../internal/schema";

const LineOffsetSchema = readonlyObject({
  leading: nonNegativeInteger(),
  trailing: nonNegativeInteger(),
});

/**
 * スコープの先頭と末尾に確保する空き行。
 */
export type LineOffset = v.InferOutput<typeof LineOffsetSchema>;

export const LineOffset = {
  schema: LineOffsetSchema,

  total: (offset: LineOffset): number => offset.leading + offset.trailing,
} as const;
