import * as v from "valibot";

import { readonlyObject } from "../internal/schema";

const RANGES = {
  lineLengthEm: { min: 10, max: 60 },
  linesPerStage: { min: 10, max: 60 },
  stagesPerPage: { min: 1, max: 3 },
} as const;

const boundedCount = (bounds: Readonly<{ min: number; max: number }>) =>
  v.pipe(v.number(), v.finite(), v.integer(), v.minValue(bounds.min), v.maxValue(bounds.max));

const NovelFlowSettingsSchema = readonlyObject({
  lineLengthEm: boundedCount(RANGES.lineLengthEm),
  linesPerStage: boundedCount(RANGES.linesPerStage),
  stagesPerPage: boundedCount(RANGES.stagesPerPage),
});

export type NovelFlowSettings = v.InferOutput<typeof NovelFlowSettingsSchema>;

export const NovelFlowSettings = {
  schema: NovelFlowSettingsSchema,
  ranges: RANGES,

  defaults: {
    lineLengthEm: 27,
    linesPerStage: 23,
    stagesPerPage: 2,
  } as const satisfies NovelFlowSettings,
} as const;
