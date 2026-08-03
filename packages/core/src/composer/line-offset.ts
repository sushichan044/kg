import type * as v from "valibot";

import { nonNegativeInteger, readonlyObject } from "../internal/schema";

const LineOffsetSchema = readonlyObject({
  leading: nonNegativeInteger(),
  trailing: nonNegativeInteger(),
});

/**
 * Blank lines reserved at the start and end of a scope.
 */
export type LineOffset = v.InferOutput<typeof LineOffsetSchema>;

export const LineOffset = {
  schema: LineOffsetSchema,

  total: (offset: LineOffset): number => offset.leading + offset.trailing,
} as const;
