import * as v from "valibot";

import { readonlyArray, readonlyObject } from "../internal/schema";
import { RubyKind } from "../parser/annotation/ruby-annotation";
import { ManuscriptRange } from "../range/manuscript-range";

const emLength = () => v.pipe(v.number(), v.finite(), v.minValue(0));
const continuation = v.union([
  v.literal("whole"),
  v.literal("start"),
  v.literal("middle"),
  v.literal("end"),
]);

const PositionedReadingGraphemeSchema = readonlyObject({
  value: v.string(),
  offsetEm: v.pipe(v.number(), v.finite()),
  advanceEm: emLength(),
});

const common = {
  annotationRange: ManuscriptRange.schema,
  fragmentRange: ManuscriptRange.schema,
  continuation,
};

const ComposedAnnotationFragmentSchema = v.variant("kind", [
  readonlyObject({ kind: v.literal("bold"), ...common }),
  readonlyObject({ kind: v.literal("italic"), ...common }),
  readonlyObject({ kind: v.literal("emphasis"), mark: v.string(), ...common }),
  readonlyObject({
    kind: v.literal("ruby"),
    rubyKind: RubyKind.schema,
    reading: v.string(),
    baseOffsetEm: emLength(),
    baseAdvanceEm: emLength(),
    readingGraphemes: readonlyArray(PositionedReadingGraphemeSchema),
    ...common,
  }),
]);

/**
 * The part of one annotation that falls on one line. An annotation whose base text wraps produces
 * several fragments, and `continuation` says which piece this is, so a renderer can leave a ruby or
 * an emphasis run open at the line end instead of closing it there.
 *
 * A ruby fragment carries its own placement: `baseOffsetEm` and `baseAdvanceEm` locate the base
 * text it annotates, and `readingGraphemes` positions each reading character over it. That is what
 * distinguishes モノルビ (JLReq 3.3.5) and 熟語ルビ (3.3.7), which align per base character, from グループルビ
 * (3.3.6), which spreads one reading across the whole base.
 *
 * `mark` on an emphasis fragment is the character set beside each base character (圏点, JLReq 3.3.9).
 */
export type ComposedAnnotationFragment = v.InferOutput<typeof ComposedAnnotationFragmentSchema>;

export const ComposedAnnotationFragment = {
  schema: ComposedAnnotationFragmentSchema,
} as const;
