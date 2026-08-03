import * as v from "valibot";

import { readonlyObject } from "../../internal/schema";
import { ManuscriptRange } from "../../range/manuscript-range";

const ItalicAnnotationSchema = readonlyObject({
  kind: v.literal("italic"),
  range: ManuscriptRange.schema,
});

export type ItalicAnnotation = v.InferOutput<typeof ItalicAnnotationSchema>;

export const ItalicAnnotation = { schema: ItalicAnnotationSchema } as const;
