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

/**
 * How a reading is associated with the base text it annotates (ルビ, JLReq 3.3).
 *
 * `group` is グループルビ (3.3.6): one reading spread over the whole base, with no correspondence between
 * individual characters. `mono` is モノルビ (3.3.5): one reading segment per base character, each set
 * over its own character. `jukugo` is 熟語ルビ (3.3.7): a compound whose segments stay associated with
 * their base characters, so it is set like モノルビ when it fits and like グループルビ when a reading would
 * otherwise collide with its neighbour.
 */
export type RubyKind = v.InferOutput<typeof RubyKindSchema>;

/**
 * The reading itself. `mono` and `jukugo` carry one segment per base grapheme, and a count that
 * disagrees with the base makes the parsed manuscript invalid rather than being padded or trimmed.
 */
export type RubyReading = v.InferOutput<typeof RubyReadingSchema>;

export type RubyAnnotation = v.InferOutput<typeof RubyAnnotationSchema>;

export const RubyKind = { schema: RubyKindSchema } as const;
export const RubyReading = { schema: RubyReadingSchema } as const;
export const RubyAnnotation = { schema: RubyAnnotationSchema } as const;
