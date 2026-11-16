import * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { renderUnitEntries, validRenderSources } from "./internal/render-unit-contract";

const combinedEntries = {
  ...renderUnitEntries,
  kind: v.literal("combined-glyph"),
  disposition: v.literal("placed"),
};

const CombinedGlyphUnitSchema = v.pipe(
  v.variant("presentation", [
    readonlyObject({ ...combinedEntries, presentation: v.literal("sideways") }),
    readonlyObject({
      ...combinedEntries,
      presentation: v.literal("tate-chu-yoko"),
      horizontalAdvanceEm: v.pipe(v.number(), v.finite(), v.gtValue(0)),
    }),
  ]),
  v.check(
    (unit) =>
      unit.range.graphemes.end >= unit.range.graphemes.start + 2 && validRenderSources(unit),
  ),
);

/**
 * 分割できない一つの描画命令。構成要素の位置は、個別に確定しているか、共有されている。
 *
 * 縦中横の `horizontalAdvanceEm` は、連なりを横に組んだときの送り幅（本文の全角単位）
 * 縦中横は全角 1 字分に組むので、描画はこの幅を全角 1 字分に縮める
 */
export type CombinedGlyphUnit = v.InferOutput<typeof CombinedGlyphUnitSchema>;

export const CombinedGlyphUnit = { schema: CombinedGlyphUnitSchema } as const;
