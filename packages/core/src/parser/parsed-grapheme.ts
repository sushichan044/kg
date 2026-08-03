import * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";

const ParsedGraphemeSchema = readonlyObject({
  value: v.string(),
  range: ManuscriptRange.schema,
});

/**
 * One user-perceived character of display text, mapped back to where it came from.
 */
export type ParsedGrapheme = v.InferOutput<typeof ParsedGraphemeSchema>;

export const ParsedGrapheme = { schema: ParsedGraphemeSchema } as const;
