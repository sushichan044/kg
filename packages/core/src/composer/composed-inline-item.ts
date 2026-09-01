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

export type ComposedInlineItem = v.InferOutput<typeof ComposedInlineItemSchema>;
export type ComposedGlyph = v.InferOutput<typeof GlyphItemSchema>;
export type ComposedGlue = v.InferOutput<
  typeof GeneratedGlueItemSchema | typeof SourceGlueItemSchema
>;
export type ComposedKern = v.InferOutput<typeof KernItemSchema>;
export type SuppressedInlineItem = v.InferOutput<typeof SuppressedItemSchema>;

export const ComposedInlineItem = { schema: ComposedInlineItemSchema } as const;
