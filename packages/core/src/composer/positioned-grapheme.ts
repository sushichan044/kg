import * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";

const emLength = () => v.pipe(v.number(), v.finite(), v.minValue(0));

const PositionedGraphemeSchema = readonlyObject({
  kind: v.literal("grapheme"),
  value: v.string(),
  range: ManuscriptRange.schema,
  offsetEm: emLength(),
  advanceEm: emLength(),
  disposition: v.union([v.literal("placed"), v.literal("hanging")]),
});

export type PositionedGrapheme = v.InferOutput<typeof PositionedGraphemeSchema>;

export const PositionedGrapheme = { schema: PositionedGraphemeSchema } as const;

const SuppressedGraphemeSchema = readonlyObject({
  kind: v.literal("suppressed"),
  value: v.string(),
  range: ManuscriptRange.schema,
  reason: v.literal("question-or-exclamation-gap"),
});

export type SuppressedGrapheme = v.InferOutput<typeof SuppressedGraphemeSchema>;

export const SuppressedGrapheme = { schema: SuppressedGraphemeSchema } as const;
