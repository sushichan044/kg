import * as v from "valibot";

import { TextRange } from "./text-range";

const GraphemeRangeSchema = v.pipe(TextRange.schema, v.brand("GraphemeRange"));

/**
 * Indices into the display grapheme array, not offsets into any string. A grapheme (書記素) is what a
 * reader counts as one character and what the composer sets on one em, so a base character and its
 * combining marks — or an emoji built from several code points — index as one.
 */
export type GraphemeRange = v.InferOutput<typeof GraphemeRangeSchema>;

export const GraphemeRange = { schema: GraphemeRangeSchema } as const;
