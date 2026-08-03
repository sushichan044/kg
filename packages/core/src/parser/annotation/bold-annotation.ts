import * as v from "valibot";

import { readonlyObject } from "../../internal/schema";
import { ManuscriptRange } from "../../range/manuscript-range";

const BoldAnnotationSchema = readonlyObject({
  kind: v.literal("bold"),
  range: ManuscriptRange.schema,
});

export type BoldAnnotation = v.InferOutput<typeof BoldAnnotationSchema>;

export const BoldAnnotation = { schema: BoldAnnotationSchema } as const;
