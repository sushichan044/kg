import * as v from "valibot";

import { TextRange } from "./text-range";

/**
 * UTF-16 offsets into the display text, from which service-specific notation has been removed.
 */
const DisplayRangeSchema = v.pipe(TextRange.schema, v.brand("DisplayRange"));

export type DisplayRange = v.InferOutput<typeof DisplayRangeSchema>;

export const DisplayRange = { schema: DisplayRangeSchema } as const;
