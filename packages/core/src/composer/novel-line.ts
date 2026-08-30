import * as v from "valibot";

import { readonlyArray, readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";
import { ComposedAnnotationFragment } from "./composed-annotation-fragment";
import { PositionedGrapheme, SuppressedGrapheme } from "./positioned-grapheme";

const NovelLineSchema = readonlyObject({
  range: v.nullable(ManuscriptRange.schema),
  advanceEm: v.pipe(v.number(), v.finite(), v.minValue(0)),
  graphemes: readonlyArray(PositionedGrapheme.schema),
  suppressed: readonlyArray(SuppressedGrapheme.schema),
  annotations: readonlyArray(ComposedAnnotationFragment.schema),
});

export type NovelLine = v.InferOutput<typeof NovelLineSchema>;

export const NovelLine = {
  schema: NovelLineSchema,

  empty: (): NovelLine => ({
    range: null,
    advanceEm: 0,
    graphemes: [],
    suppressed: [],
    annotations: [],
  }),
} as const;
