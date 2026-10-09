import * as v from "valibot";

import { CombinedGlyphUnit } from "./combined-glyph-unit";
import { ComposedGlue, ComposedKern, SuppressedInlineItem } from "./composed-inline-item";
import { SingleGlyphUnit } from "./single-glyph-unit";

const PositionedInlineItemSchema = v.union([
  SingleGlyphUnit.schema,
  CombinedGlyphUnit.schema,
  ComposedGlue.schema,
  ComposedKern.schema,
  SuppressedInlineItem.schema,
]);

export type PositionedInlineItem = v.InferOutput<typeof PositionedInlineItemSchema>;

export const PositionedInlineItem = {
  schema: PositionedInlineItemSchema,
  isRenderUnit: (item: PositionedInlineItem): item is SingleGlyphUnit | CombinedGlyphUnit =>
    item.kind === "glyph" || item.kind === "combined-glyph",
} as const;
