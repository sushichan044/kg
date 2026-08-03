import type * as v from "valibot";

import { nonNegativeInteger, readonlyObject } from "../internal/schema";

const CompositionStatisticsSchema = readonlyObject({
  chars: nonNegativeInteger(),
  sourceLines: nonNegativeInteger(),
  pages: nonNegativeInteger(),
});

export type CompositionStatistics = v.InferOutput<typeof CompositionStatisticsSchema>;

export const CompositionStatistics = { schema: CompositionStatisticsSchema } as const;
