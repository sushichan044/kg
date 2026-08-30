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
 * How a source run is presented in a vertical line. The group range also defines its legal
 * line-breaking boundary; tate-chu-yoko additionally renders the whole group as one inline unit.
 */
export type VerticalTextPresentation = v.InferOutput<typeof VerticalTextPresentationSchema>;

export const VerticalTextPresentation = { schema: VerticalTextPresentationSchema } as const;
