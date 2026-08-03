import * as v from "valibot";

import { readonlyArray, readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";
import { GridLine } from "./grid-line";

const GridStageSchema = readonlyObject({
  range: v.nullable(ManuscriptRange.schema),
  lines: readonlyArray(GridLine.schema),
});

/**
 * A block of lines; a page holds one or more stacked vertically.
 */
export type GridStage = v.InferOutput<typeof GridStageSchema>;

export const GridStage = {
  schema: GridStageSchema,

  of: (lines: readonly GridLine[]): GridStage => ({
    lines,
    range: ManuscriptRange.merge(lines.map(({ range }) => range)),
  }),
} as const;
