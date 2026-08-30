import * as v from "valibot";

import { readonlyObject } from "../../internal/schema";
import { ManuscriptRange } from "../../range/manuscript-range";

const GroupRubyKindSchema = v.literal("group");
const MonoRubyKindSchema = v.literal("mono");
const JukugoRubyKindSchema = v.literal("jukugo");
const RubyKindSchema = v.union([GroupRubyKindSchema, MonoRubyKindSchema, JukugoRubyKindSchema]);

const RubyReadingSchema = v.variant("kind", [
  readonlyObject({
    kind: GroupRubyKindSchema,
    text: v.pipe(v.string(), v.nonEmpty()),
  }),
  readonlyObject({
    kind: MonoRubyKindSchema,
    segments: v.pipe(v.array(v.pipe(v.string(), v.nonEmpty())), v.nonEmpty(), v.readonly()),
  }),
  readonlyObject({
    kind: JukugoRubyKindSchema,
    segments: v.pipe(v.array(v.pipe(v.string(), v.nonEmpty())), v.nonEmpty(), v.readonly()),
  }),
]);

const RubyAnnotationSchema = readonlyObject({
  kind: v.literal("ruby"),
  range: ManuscriptRange.schema,
  reading: RubyReadingSchema,
});

export type RubyKind = v.InferOutput<typeof RubyKindSchema>;
export type RubyReading = v.InferOutput<typeof RubyReadingSchema>;
export type RubyAnnotation = v.InferOutput<typeof RubyAnnotationSchema>;

export const RubyKind = { schema: RubyKindSchema } as const;
export const RubyReading = { schema: RubyReadingSchema } as const;
export const RubyAnnotation = { schema: RubyAnnotationSchema } as const;
