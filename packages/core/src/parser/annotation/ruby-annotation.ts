import * as v from "valibot";

import { readonlyObject } from "../../internal/schema";
import { ManuscriptRange } from "../../range/manuscript-range";

const RubyReadingSchema = v.variant("kind", [
  readonlyObject({
    kind: v.literal("group"),
    text: v.pipe(v.string(), v.nonEmpty()),
  }),
  readonlyObject({
    kind: v.literal("mono"),
    segments: v.pipe(v.array(v.pipe(v.string(), v.nonEmpty())), v.nonEmpty(), v.readonly()),
  }),
  readonlyObject({
    kind: v.literal("jukugo"),
    segments: v.pipe(v.array(v.pipe(v.string(), v.nonEmpty())), v.nonEmpty(), v.readonly()),
  }),
]);

const RubyAnnotationSchema = readonlyObject({
  kind: v.literal("ruby"),
  range: ManuscriptRange.schema,
  reading: RubyReadingSchema,
});

export type RubyReading = v.InferOutput<typeof RubyReadingSchema>;
export type RubyAnnotation = v.InferOutput<typeof RubyAnnotationSchema>;

export const RubyReading = { schema: RubyReadingSchema } as const;
export const RubyAnnotation = { schema: RubyAnnotationSchema } as const;
