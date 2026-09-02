import * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";
import { InlineSpan } from "./inline-span";
import { VerticalTextPresentation } from "./vertical-text-presentation";

const signedEm = () => v.pipe(v.number(), v.finite());

const GlyphItemSchema = readonlyObject({
  kind: v.literal("glyph"),
  value: v.string(),
  range: ManuscriptRange.schema,
  layoutSpan: InlineSpan.schema,
  renderSpan: InlineSpan.schema,
  disposition: v.union([v.literal("placed"), v.literal("hanging")]),
  presentation: VerticalTextPresentation.schema,
});

const GeneratedGlueItemSchema = readonlyObject({
  kind: v.literal("glue"),
  origin: v.literal("generated"),
  offsetEm: signedEm(),
  widthEm: signedEm(),
  naturalWidthEm: signedEm(),
  adjustment: v.union([v.literal("natural"), v.literal("shrunk"), v.literal("stretched")]),
});

const SourceGlueItemSchema = readonlyObject({
  kind: v.literal("glue"),
  origin: v.literal("source"),
  value: v.string(),
  range: ManuscriptRange.schema,
  offsetEm: signedEm(),
  widthEm: signedEm(),
  naturalWidthEm: signedEm(),
  adjustment: v.union([v.literal("natural"), v.literal("shrunk"), v.literal("stretched")]),
});

const KernItemSchema = readonlyObject({
  kind: v.literal("kern"),
  offsetEm: signedEm(),
  widthEm: signedEm(),
});

const SuppressedItemSchema = readonlyObject({
  kind: v.literal("suppressed"),
  value: v.string(),
  range: ManuscriptRange.schema,
  reason: v.literal("question-or-exclamation-gap"),
});

const ComposedInlineItemSchema = v.union([
  GlyphItemSchema,
  GeneratedGlueItemSchema,
  SourceGlueItemSchema,
  KernItemSchema,
  SuppressedItemSchema,
]);

/**
 * Everything the composer placed on one line, in visual order: the glyphs plus every spacing
 * decision made between them. A renderer can lay out a line from these items alone, without
 * reapplying any Japanese typesetting rule itself.
 */
export type ComposedInlineItem = v.InferOutput<typeof ComposedInlineItemSchema>;

/**
 * One positioned character. `layoutSpan` is the advance the line was measured and broken against —
 * a half em for the brackets and punctuation JLReq sets that way — and `renderSpan` is where the
 * glyph is actually drawn, so a renderer never has to rediscover the offset.
 *
 * The two come apart wherever the ink and the advance disagree. A hanging character (ぶら下げ組,
 * `disposition: "hanging"`) is the clearest case: it takes no room on the line, so its `layoutSpan`
 * is zero wide while its `renderSpan` still occupies a full em outside the text area.
 *
 * `presentation` carries the vertical orientation already chosen for the run.
 */
export type ComposedGlyph = v.InferOutput<typeof GlyphItemSchema>;

/**
 * An inter-character space (アキ) the line adjustment was allowed to resize. `naturalWidthEm` is what
 * the pair called for and `widthEm` what the chosen break settled on, with `adjustment` naming
 * which of the two happened. `origin: "source"` marks a space that was written in the manuscript
 * rather than derived from a character-class pair.
 */
export type ComposedGlue = v.InferOutput<
  typeof GeneratedGlueItemSchema | typeof SourceGlueItemSchema
>;

/**
 * A fixed space (詰め) that line adjustment never touches. It is negative between two half-em
 * characters, such as a run of brackets, where their advances would otherwise leave a full em of
 * white; it is zero between two inseparable characters, which must butt together with no gap at
 * all.
 */
export type ComposedKern = v.InferOutput<typeof KernItemSchema>;

/**
 * A character present in the source but not set on this line. The one reason today is the
 * ideographic space a manuscript writes after `！` or `？` to satisfy JLReq 3.1.6: the gap exists to
 * separate the mark from what follows, so it is dropped once a line break already separates them.
 * The character is reported rather than deleted, so a line still maps back to its whole source
 * span.
 */
export type SuppressedInlineItem = v.InferOutput<typeof SuppressedItemSchema>;

export const ComposedInlineItem = { schema: ComposedInlineItemSchema } as const;
