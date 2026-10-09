import * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { InlineSpan } from "./inline-span";

const AnnotationPlacementSchema = readonlyObject({
  side: v.picklist(["before", "after"]),
  inlineSpan: InlineSpan.schema,
  blockOffsetEm: v.pipe(v.number(), v.finite()),
  blockSizeEm: v.pipe(v.number(), v.finite(), v.minValue(0)),
});

/**
 * Block offsets start at the body's right edge and increase leftward in vertical-rl.
 */
export type AnnotationPlacement = v.InferOutput<typeof AnnotationPlacementSchema>;

export const AnnotationPlacement = { schema: AnnotationPlacementSchema } as const;
