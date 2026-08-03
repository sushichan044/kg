import * as v from "valibot";

import { readonlyArray, readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";
import { GridStage } from "./grid-stage";

const GridPageSchema = readonlyObject({
  range: v.nullable(ManuscriptRange.schema),
  stages: readonlyArray(GridStage.schema),
});

export type GridPage = v.InferOutput<typeof GridPageSchema>;

export const GridPage = {
  schema: GridPageSchema,

  of: (stages: readonly GridStage[]): GridPage => ({
    stages,
    range: ManuscriptRange.merge(stages.map(({ range }) => range)),
  }),
} as const;
