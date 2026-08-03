import * as v from "valibot";

import { readonlyObject } from "../../internal/schema";
import { ManuscriptRange } from "../../range/manuscript-range";

const EmphasisAnnotationSchema = readonlyObject({
  kind: v.literal("emphasis"),
  range: ManuscriptRange.schema,
  mark: v.string(),
});

export type EmphasisAnnotation = v.InferOutput<typeof EmphasisAnnotationSchema>;

export const EmphasisAnnotation = { schema: EmphasisAnnotationSchema } as const;
