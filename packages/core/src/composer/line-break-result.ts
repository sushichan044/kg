import * as v from "valibot";

import { readonlyObject } from "../internal/schema";

const LineBreakResultSchema = v.variant("kind", [
  readonlyObject({ kind: v.literal("natural") }),
  readonlyObject({ kind: v.literal("shrunk") }),
  readonlyObject({ kind: v.literal("stretched") }),
  readonlyObject({ kind: v.literal("hanging") }),
  readonlyObject({ kind: v.literal("forced") }),
  readonlyObject({ kind: v.literal("paragraph-end") }),
]);

/**
 * What the line adjustment (行の調整処理) did to make this line fit its measure.
 *
 * `natural` fit as set. `shrunk` overflowed and the space around punctuation absorbed the excess.
 * `hanging` overflowed and its last character, a full stop or comma, was set outside the text area
 * (ぶら下げ組). `stretched` fell short and the stretchable space took up the slack. `forced` could do
 * none of those. `paragraph-end` is not an adjustment at all — the paragraph simply ran out.
 *
 * So `shrunk` and `hanging` answer an overflowing line while `stretched` answers a short one; they
 * are not successive fallbacks for the same line. Which lines end up in which state is settled for
 * the paragraph as a whole rather than line by line: the composer minimises, in order, the number
 * of `forced` lines, then `stretched`, then `hanging`, then `shrunk` lines that spent space the
 * reader can see. A line that shrank only invisible space costs the paragraph nothing.
 */
export type LineBreakResult = v.InferOutput<typeof LineBreakResultSchema>;

export const LineBreakResult = { schema: LineBreakResultSchema } as const;
