import * as v from "valibot";

import { readonlyArray, readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";
import { NovelStage } from "./novel-stage";

const NovelPageSchema = readonlyObject({
  range: v.nullable(ManuscriptRange.schema),
  stages: readonlyArray(NovelStage.schema),
});

export type NovelPage = v.InferOutput<typeof NovelPageSchema>;

export const NovelPage = {
  schema: NovelPageSchema,
  of: (stages: readonly NovelStage[]): NovelPage => ({
    stages,
    range: ManuscriptRange.merge(stages.map(({ range }) => range)),
  }),
} as const;
