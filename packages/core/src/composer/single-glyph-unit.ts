import * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { renderUnitEntries, validRenderSources } from "./internal/render-unit-contract";

const SingleGlyphUnitSchema = v.pipe(
  readonlyObject({
    ...renderUnitEntries,
    kind: v.literal("glyph"),
    presentation: v.picklist(["mixed", "upright", "sideways"]),
    disposition: v.picklist(["placed", "hanging"]),
  }),
  v.check(
    (unit) =>
      unit.range.graphemes.end === unit.range.graphemes.start + 1 && validRenderSources(unit),
  ),
  v.check((unit) => unit.disposition !== "hanging" || unit.layoutSpan.advanceEm === 0),
);

export type SingleGlyphUnit = v.InferOutput<typeof SingleGlyphUnitSchema>;

export const SingleGlyphUnit = { schema: SingleGlyphUnitSchema } as const;
