import * as v from "valibot";

import { readonlyArray, readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";
import { ComposedAnnotationFragment } from "./composed-annotation-fragment";
import { ComposedInlineItem } from "./composed-inline-item";
import { LineBreakResult } from "./line-break-result";

const NovelLineSchema = readonlyObject({
  range: v.nullable(ManuscriptRange.schema),
  inlineSizeEm: v.pipe(v.number(), v.finite(), v.minValue(0)),
  items: readonlyArray(ComposedInlineItem.schema),
  break: LineBreakResult.schema,
  annotations: readonlyArray(ComposedAnnotationFragment.schema),
});

export type NovelLine = v.InferOutput<typeof NovelLineSchema>;

export const NovelLine = {
  schema: NovelLineSchema,

  empty: (): NovelLine => ({
    range: null,
    inlineSizeEm: 0,
    items: [],
    break: { kind: "paragraph-end" },
    annotations: [],
  }),
} as const;
