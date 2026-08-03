import * as v from "valibot";

import { ManuscriptRange } from "../../range/manuscript-range";
import { BoldAnnotation } from "./bold-annotation";
import { EmphasisAnnotation } from "./emphasis-annotation";
import { ItalicAnnotation } from "./italic-annotation";
import { RubyAnnotation } from "./ruby-annotation";

const ManuscriptAnnotationSchema = v.variant("kind", [
  RubyAnnotation.schema,
  BoldAnnotation.schema,
  ItalicAnnotation.schema,
  EmphasisAnnotation.schema,
]);

/**
 * A closed set: parsers normalise service-specific notation into exactly these four variants.
 */
export type ManuscriptAnnotation = v.InferOutput<typeof ManuscriptAnnotationSchema>;

export const ManuscriptAnnotation = {
  schema: ManuscriptAnnotationSchema,

  overlapping: (
    annotations: readonly ManuscriptAnnotation[],
    range: ManuscriptRange,
  ): readonly ManuscriptAnnotation[] =>
    annotations.filter((annotation) => ManuscriptRange.overlaps(annotation.range, range)),

  /**
   * Stable order for rendering: outermost span first, then by variant name.
   */
  compare: (left: ManuscriptAnnotation, right: ManuscriptAnnotation): number =>
    left.range.source.start - right.range.source.start ||
    left.range.source.end - right.range.source.end ||
    left.kind.localeCompare(right.kind),
} as const;
