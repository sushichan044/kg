import * as v from "valibot";

import { TextRange } from "./text-range";

const SourceRangeSchema = v.pipe(TextRange.schema, v.brand("SourceRange"));

/**
 * UTF-16 offsets into the unmodified source text, including any service-specific notation.
 */
export type SourceRange = v.InferOutput<typeof SourceRangeSchema>;

export const SourceRange = { schema: SourceRangeSchema } as const;
