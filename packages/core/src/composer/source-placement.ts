import * as v from "valibot";

import { readonlyArray, readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";
import { InlineSpan } from "./inline-span";

const memberRange = v.pipe(
  ManuscriptRange.schema,
  v.check(({ graphemes }) => graphemes.end === graphemes.start + 1),
);
const SourcePlacementSchema = v.variant("kind", [
  readonlyObject({ kind: v.literal("exact"), range: memberRange, layoutSpan: InlineSpan.schema }),
  readonlyObject({
    kind: v.literal("shared"),
    ranges: v.pipe(readonlyArray(memberRange), v.minLength(2)),
    layoutSpan: InlineSpan.schema,
  }),
]);

/**
 * 論理上のソース位置。共有された位置は、その内側にキャレットを置ける位置があることを意味しない。
 */
export type SourcePlacement = v.InferOutput<typeof SourcePlacementSchema>;

export const SourcePlacement = {
  schema: SourcePlacementSchema,
  ranges: (placement: SourcePlacement): readonly ManuscriptRange[] =>
    placement.kind === "exact" ? [placement.range] : placement.ranges,
} as const;
