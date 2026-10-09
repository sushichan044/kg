import * as v from "valibot";

import { readonlyArray, readonlyObject } from "../internal/schema";
import { graphemeSegmenter } from "../internal/segmenter";
import { RubyKind } from "../parser/annotation/ruby-annotation";
import { ManuscriptRange } from "../range/manuscript-range";
import { AnnotationPlacement } from "./annotation-placement";
import { MeasurementTextRange } from "./measurement-text-range";

const common = {
  annotationRange: ManuscriptRange.schema,
  fragmentRange: ManuscriptRange.schema,
  continuation: v.picklist(["whole", "start", "middle", "end"]),
};

const readingItem = readonlyObject({
  value: v.pipe(v.string(), v.nonEmpty()),
  textRange: MeasurementTextRange.schema,
  placement: AnnotationPlacement.schema,
});

const ComposedAnnotationFragmentSchema = v.pipe(
  v.variant("kind", [
    readonlyObject({ kind: v.literal("bold"), ...common }),
    readonlyObject({ kind: v.literal("italic"), ...common }),
    readonlyObject({
      kind: v.literal("emphasis"),
      mark: v.string(),
      placements: readonlyArray(AnnotationPlacement.schema),
      ...common,
    }),
    readonlyObject({
      kind: v.literal("ruby"),
      rubyKind: RubyKind.schema,
      reading: v.string(),
      readingItems: readonlyArray(readingItem),
      ...common,
    }),
  ]),
  v.check((fragment) => {
    const { annotationRange, fragmentRange } = fragment;
    if (
      fragmentRange.graphemes.start < annotationRange.graphemes.start ||
      fragmentRange.graphemes.end > annotationRange.graphemes.end ||
      fragmentRange.source.start < annotationRange.source.start ||
      fragmentRange.source.end > annotationRange.source.end ||
      fragmentRange.display.start < annotationRange.display.start ||
      fragmentRange.display.end > annotationRange.display.end
    )
      return false;
    const starts = fragmentRange.graphemes.start === annotationRange.graphemes.start;
    const ends = fragmentRange.graphemes.end === annotationRange.graphemes.end;
    const continuation = starts && ends ? "whole" : starts ? "start" : ends ? "end" : "middle";
    if (fragment.continuation !== continuation) return false;
    if (fragment.kind !== "ruby") return true;
    const boundaries = new Set(
      [...graphemeSegmenter.segment(fragment.reading)].map(({ index }) => index),
    );
    boundaries.add(fragment.reading.length);
    let end = 0;
    for (const item of fragment.readingItems) {
      if (
        item.textRange.start !== end ||
        item.textRange.end <= end ||
        !boundaries.has(item.textRange.end) ||
        fragment.reading.slice(end, item.textRange.end) !== item.value
      )
        return false;
      end = item.textRange.end;
    }
    return end === fragment.reading.length;
  }),
);

/**
 * A source-associated fragment with composer-owned decoration positions in body em.
 */
export type ComposedAnnotationFragment = v.InferOutput<typeof ComposedAnnotationFragmentSchema>;

export const ComposedAnnotationFragment = { schema: ComposedAnnotationFragmentSchema } as const;
