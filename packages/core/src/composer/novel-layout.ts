import type * as v from "valibot";

import { readonlyArray, readonlyObject } from "../internal/schema";
import { CompositionStatistics } from "./composition-statistics";
import { ManuscriptGeometry } from "./manuscript-geometry";
import { NovelPage } from "./novel-page";

const NovelLayoutSchema = readonlyObject({
  pages: readonlyArray(NovelPage.schema),
  geometry: ManuscriptGeometry.schema,
  stats: CompositionStatistics.schema,
});

export type NovelLayout = v.InferOutput<typeof NovelLayoutSchema>;

export const NovelLayout = { schema: NovelLayoutSchema } as const;
