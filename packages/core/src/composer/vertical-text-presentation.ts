import * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";

const common = { groupRange: ManuscriptRange.schema };
const VerticalTextPresentationSchema = v.variant("kind", [
  readonlyObject({ kind: v.literal("mixed"), ...common }),
  readonlyObject({ kind: v.literal("upright"), ...common }),
  readonlyObject({ kind: v.literal("sideways"), ...common }),
  readonlyObject({ kind: v.literal("tate-chu-yoko"), ...common }),
]);

/**
 * How a source run is presented in a vertical line (縦組), decided before anything is measured so
 * that a renderer never has to infer orientation for itself.
 *
 * `mixed` is Japanese text, set as the line runs. `upright` stands a run up one em per character —
 * fullwidth alphanumerics, a lone Latin letter, and the Latin abbreviations that read as words.
 * `sideways` rotates a western word so it reads down the line. `tate-chu-yoko` (縦中横, JLReq 3.2.5)
 * sets a two-digit number upright inside a single em.
 *
 * The group range also defines its legal line-breaking boundary; tate-chu-yoko additionally renders
 * the whole group as one inline unit.
 */
export type VerticalTextPresentation = v.InferOutput<typeof VerticalTextPresentationSchema>;

export const VerticalTextPresentation = { schema: VerticalTextPresentationSchema } as const;
