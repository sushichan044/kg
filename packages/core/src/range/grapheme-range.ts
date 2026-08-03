import * as v from "valibot";

import { TextRange } from "./text-range";

const GraphemeRangeSchema = v.pipe(TextRange.schema, v.brand("GraphemeRange"));

/**
 * Indices into the display grapheme array, not offsets into any string.
 */
export type GraphemeRange = v.InferOutput<typeof GraphemeRangeSchema>;

export const GraphemeRange = { schema: GraphemeRangeSchema } as const;
