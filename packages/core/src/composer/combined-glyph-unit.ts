import * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { renderUnitEntries, validRenderSources } from "./internal/render-unit-contract";

const CombinedGlyphUnitSchema = v.pipe(
  readonlyObject({
    ...renderUnitEntries,
    kind: v.literal("combined-glyph"),
    presentation: v.picklist(["tate-chu-yoko", "sideways"]),
    disposition: v.literal("placed"),
  }),
  v.check(
    (unit) =>
      unit.range.graphemes.end >= unit.range.graphemes.start + 2 && validRenderSources(unit),
  ),
);

/**
 * 分割できない一つの描画命令。構成要素の位置は、個別に確定しているか、共有されている。
 */
export type CombinedGlyphUnit = v.InferOutput<typeof CombinedGlyphUnitSchema>;

export const CombinedGlyphUnit = { schema: CombinedGlyphUnitSchema } as const;
