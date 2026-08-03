import * as v from "valibot";

import { readonlyArray, readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";
import { GridCell } from "./grid-cell";

const GridLineSchema = readonlyObject({
  range: v.nullable(ManuscriptRange.schema),
  cells: readonlyArray(GridCell.schema),
});

/**
 * One vertical line of cells. Its range covers whatever content the cells hold.
 */
export type GridLine = v.InferOutput<typeof GridLineSchema>;

export const GridLine = {
  schema: GridLineSchema,

  of: (cells: readonly GridCell[]): GridLine => ({
    cells,
    range: ManuscriptRange.merge(cells.map(({ range }) => range)),
  }),

  /**
   * Pads with empty cells so every line in a stage has the same length.
   */
  padded: (cells: readonly GridCell[], charsPerLine: number): GridLine =>
    GridLine.of([
      ...cells,
      ...Array.from({ length: Math.max(0, charsPerLine - cells.length) }, GridCell.empty),
    ]),
} as const;
