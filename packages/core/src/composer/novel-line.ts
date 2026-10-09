import * as v from "valibot";

import { readonlyArray, readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";
import { ComposedAnnotationFragment } from "./composed-annotation-fragment";
import { LineBreakResult } from "./line-break-result";
import { PositionedInlineItem } from "./positioned-inline-item";
import { SourcePlacement } from "./source-placement";

const NovelLineSchema = v.pipe(
  readonlyObject({
    range: v.nullable(ManuscriptRange.schema),
    inlineSizeEm: v.pipe(v.number(), v.finite(), v.minValue(0)),
    items: readonlyArray(PositionedInlineItem.schema),
    break: LineBreakResult.schema,
    annotations: readonlyArray(ComposedAnnotationFragment.schema),
  }),
  v.check((line) => {
    const ranges = line.items.flatMap((item) =>
      PositionedInlineItem.isRenderUnit(item)
        ? item.sources.flatMap(SourcePlacement.ranges)
        : item.kind === "suppressed" || (item.kind === "glue" && item.origin === "source")
          ? [item.range]
          : [],
    );
    if (line.range === null)
      return (
        ranges.length === 0 &&
        line.items.length === 0 &&
        line.annotations.length === 0 &&
        line.inlineSizeEm === 0
      );
    ranges.sort((left, right) => left.graphemes.start - right.graphemes.start);
    const first = ranges[0];
    const last = ranges.at(-1);
    if (first === undefined || last === undefined) return false;
    let end = line.range.graphemes.start;
    for (const range of ranges) {
      if (range.graphemes.start !== end) return false;
      end = range.graphemes.end;
    }
    return (
      end === line.range.graphemes.end &&
      first.source.start === line.range.source.start &&
      last.source.end === line.range.source.end &&
      first.display.start === line.range.display.start &&
      last.display.end === line.range.display.end &&
      line.annotations.every(
        ({ fragmentRange }) =>
          line.range !== null &&
          fragmentRange.graphemes.start >= line.range.graphemes.start &&
          fragmentRange.graphemes.end <= line.range.graphemes.end &&
          fragmentRange.source.start >= line.range.source.start &&
          fragmentRange.source.end <= line.range.source.end &&
          fragmentRange.display.start >= line.range.display.start &&
          fragmentRange.display.end <= line.range.display.end,
      )
    );
  }),
);

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
