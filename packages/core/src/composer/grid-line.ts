import * as v from "valibot";

import { readonlyArray, readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";
import { GridCell } from "./grid-cell";

const GridLineSchema = readonlyObject({
  range: v.nullable(ManuscriptRange.schema),
  cells: readonlyArray(GridCell.schema),
  hanging: readonlyArray(GridCell.schema),
});

/**
 * One vertical line of cells. Its range covers whatever content the cells and hanging punctuation
 * hold. `hanging` holds leading punctuation from the next line's content that kinsoku hangs off
 * this line instead of occupying a cell — it is not part of the fixed-width `cells` grid.
 */
export type GridLine = v.InferOutput<typeof GridLineSchema>;

export const GridLine = {
  schema: GridLineSchema,

  of: (cells: readonly GridCell[], hanging: readonly GridCell[] = []): GridLine => ({
    cells,
    hanging,
    range: ManuscriptRange.merge([...cells, ...hanging].map(({ range }) => range)),
  }),

  /**
   * Pads with empty cells so every line in a stage has the same length.
   */
  padded: (
    cells: readonly GridCell[],
    charsPerLine: number,
    hanging: readonly GridCell[] = [],
  ): GridLine =>
    GridLine.of(
      [
        ...cells,
        ...Array.from({ length: Math.max(0, charsPerLine - cells.length) }, GridCell.empty),
      ],
      hanging,
    ),
} as const;
