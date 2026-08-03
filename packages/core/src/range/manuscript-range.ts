import * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { DisplayRange } from "./display-range";
import { GraphemeRange } from "./grapheme-range";
import { SourceRange } from "./source-range";

const ManuscriptRangeSchema = readonlyObject({
  source: SourceRange.schema,
  display: DisplayRange.schema,
  graphemes: GraphemeRange.schema,
});

/**
 * The same span expressed in all three coordinate systems the pipeline maps between.
 */
export type ManuscriptRange = v.InferOutput<typeof ManuscriptRangeSchema>;

type Bounds = Readonly<{ start: number; end: number }>;

export type ManuscriptRangeInput = Readonly<{
  source: Bounds;
  display: Bounds;
  graphemes: Bounds;
}>;

export const ManuscriptRange = {
  schema: ManuscriptRangeSchema,

  /**
   * Brands a span core computed itself. Throws rather than returning a failure: the inputs come
   * from core's own arithmetic, so a violated bound is a bug here, not bad data from a caller.
   */
  of: (input: ManuscriptRangeInput): ManuscriptRange => v.parse(ManuscriptRangeSchema, input),

  merge: (ranges: ReadonlyArray<ManuscriptRange | null>): ManuscriptRange | null => {
    const present = ranges.filter((range) => range !== null);
    if (present.length === 0) return null;

    return ManuscriptRange.of({
      source: {
        start: Math.min(...present.map(({ source }) => source.start)),
        end: Math.max(...present.map(({ source }) => source.end)),
      },
      display: {
        start: Math.min(...present.map(({ display }) => display.start)),
        end: Math.max(...present.map(({ display }) => display.end)),
      },
      graphemes: {
        start: Math.min(...present.map(({ graphemes }) => graphemes.start)),
        end: Math.max(...present.map(({ graphemes }) => graphemes.end)),
      },
    });
  },

  overlaps: (range: ManuscriptRange, other: ManuscriptRange): boolean =>
    range.graphemes.start < other.graphemes.end && range.graphemes.end > other.graphemes.start,
} as const;
