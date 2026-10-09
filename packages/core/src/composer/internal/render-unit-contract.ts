import * as v from "valibot";

import { readonlyArray } from "../../internal/schema";
import { graphemeSegmenter } from "../../internal/segmenter";
import { ManuscriptRange } from "../../range/manuscript-range";
import { InlineSpan } from "../inline-span";
import { SourcePlacement } from "../source-placement";

export const renderUnitEntries = {
  value: v.pipe(v.string(), v.nonEmpty()),
  range: ManuscriptRange.schema,
  layoutSpan: InlineSpan.schema,
  renderSpan: InlineSpan.schema,
  sources: v.pipe(readonlyArray(SourcePlacement.schema), v.nonEmpty()),
};

export function validRenderSources(
  unit: Readonly<{
    value: string;
    range: ManuscriptRange;
    layoutSpan: InlineSpan;
    sources: readonly SourcePlacement[];
  }>,
): boolean {
  const ranges = unit.sources.flatMap(SourcePlacement.ranges);
  if (
    [...graphemeSegmenter.segment(unit.value)].length !== ranges.length ||
    unit.value.length !== unit.range.display.end - unit.range.display.start ||
    ranges[0]?.source.start !== unit.range.source.start
  )
    return false;
  let end = unit.range.graphemes.start;
  let displayEnd = unit.range.display.start;
  let sourceEnd = unit.range.source.start;
  let layoutEnd = unit.layoutSpan.offsetEm;
  for (const placement of unit.sources) {
    if (Math.abs(placement.layoutSpan.offsetEm - layoutEnd) > 1e-9) return false;
    layoutEnd += placement.layoutSpan.advanceEm;
    for (const range of SourcePlacement.ranges(placement)) {
      if (
        range.graphemes.start !== end ||
        range.display.start !== displayEnd ||
        range.source.start < sourceEnd
      )
        return false;
      end = range.graphemes.end;
      displayEnd = range.display.end;
      sourceEnd = range.source.end;
    }
  }
  return (
    end === unit.range.graphemes.end &&
    displayEnd === unit.range.display.end &&
    sourceEnd === unit.range.source.end &&
    Math.abs(layoutEnd - unit.layoutSpan.offsetEm - unit.layoutSpan.advanceEm) <= 1e-9
  );
}
