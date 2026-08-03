import type * as v from "valibot";

import { readonlyArray, readonlyObject } from "../internal/schema";
import { CompositionStatistics } from "./composition-statistics";
import { GridPage } from "./grid-page";
import { ManuscriptGeometry } from "./manuscript-geometry";

const ManuscriptGridLayoutSchema = readonlyObject({
  pages: readonlyArray(GridPage.schema),
  geometry: ManuscriptGeometry.schema,
  stats: CompositionStatistics.schema,
});

/**
 * What the built-in grid composer produces: paginated cells plus the page's physical size.
 */
export type ManuscriptGridLayout = v.InferOutput<typeof ManuscriptGridLayoutSchema>;

export const ManuscriptGridLayout = { schema: ManuscriptGridLayoutSchema } as const;
