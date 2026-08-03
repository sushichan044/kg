import * as v from "valibot";

import { readonlyObject } from "../../internal/schema";
import { ManuscriptRange } from "../../range/manuscript-range";

const RubyAnnotationSchema = readonlyObject({
  kind: v.literal("ruby"),
  range: ManuscriptRange.schema,
  reading: v.string(),
});

export type RubyAnnotation = v.InferOutput<typeof RubyAnnotationSchema>;

export const RubyAnnotation = { schema: RubyAnnotationSchema } as const;
