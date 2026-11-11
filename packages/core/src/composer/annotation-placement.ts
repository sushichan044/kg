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
 * 行送り方向のオフセットは本文の右端を起点とし、vertical-rl では左へ進むほど大きくなる。
 */
export type AnnotationPlacement = v.InferOutput<typeof AnnotationPlacementSchema>;

export const AnnotationPlacement = { schema: AnnotationPlacementSchema } as const;
