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
 * ルビ文字を親文字にどう対応づけるか（ルビ、JLReq 3.3）。
 *
 * `group` はグループルビ（3.3.6）で、1 つのルビ文字を親文字全体に振り、
 * 個々の文字との対応を持たない。`mono` はモノルビ（3.3.5）で、
 * 親文字 1 文字ごとにルビ文字の区切りが 1 つあり、それぞれ対応する文字に振る。
 * `jukugo` は熟語ルビ（3.3.7）で、熟語の中で各区切りが親文字との対応を保つ。
 * 収まるときはモノルビのように、ルビ文字が隣と衝突するときはグループルビのように組む。
 */
export type RubyKind = v.InferOutput<typeof RubyKindSchema>;

/**
 * ルビ文字そのもの。`mono` と `jukugo` は、親文字の書記素 1 つにつき区切りを 1 つ持つ。
 * 個数が親文字と食い違う場合は、補ったり削ったりせず、パース結果を不正とする。
 */
export type RubyReading = v.InferOutput<typeof RubyReadingSchema>;

export type RubyAnnotation = v.InferOutput<typeof RubyAnnotationSchema>;

export const RubyKind = { schema: RubyKindSchema } as const;
export const RubyReading = { schema: RubyReadingSchema } as const;
export const RubyAnnotation = { schema: RubyAnnotationSchema } as const;
