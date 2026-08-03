import * as v from "valibot";

import { readonlyArray, readonlyObject } from "../internal/schema";
import { ManuscriptAnnotation } from "../parser/annotation/manuscript-annotation";
import { ManuscriptRange } from "../range/manuscript-range";

const GridCellSchema = readonlyObject({
  value: v.nullable(v.string()),
  range: v.nullable(ManuscriptRange.schema),
  annotations: readonlyArray(ManuscriptAnnotation.schema),
});

/**
 * One square of manuscript paper. A cell with no content has a `null` value and range.
 */
export type GridCell = v.InferOutput<typeof GridCellSchema>;

export const GridCell = {
  schema: GridCellSchema,

  empty: (): GridCell => ({ value: null, range: null, annotations: [] }),
} as const;
