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

export type ComposedAnnotationFragment = v.InferOutput<typeof ComposedAnnotationFragmentSchema>;

export const ComposedAnnotationFragment = {
  schema: ComposedAnnotationFragmentSchema,
} as const;
