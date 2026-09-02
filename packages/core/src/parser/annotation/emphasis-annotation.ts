import * as v from "valibot";

import { readonlyObject } from "../../internal/schema";
import { ManuscriptRange } from "../../range/manuscript-range";

const EmphasisAnnotationSchema = readonlyObject({
  kind: v.literal("emphasis"),
  range: ManuscriptRange.schema,
  mark: v.string(),
});

/**
 * Emphasis dots (圏点, JLReq 3.3.9): a mark repeated beside every character of the base run, which is
 * how Japanese text emphasises a phrase in place of italics. `mark` is the character to repeat:
 * some notations fix it, others let the source name one, so the parser records what was written
 * rather than normalising it.
 */
export type EmphasisAnnotation = v.InferOutput<typeof EmphasisAnnotationSchema>;

export const EmphasisAnnotation = { schema: EmphasisAnnotationSchema } as const;
