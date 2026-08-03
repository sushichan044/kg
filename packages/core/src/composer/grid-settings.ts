import * as v from "valibot";

import { readonlyObject } from "../internal/schema";

const RANGES = {
  charsPerLine: { min: 10, max: 60 },
  linesPerStage: { min: 10, max: 60 },
  stagesPerPage: { min: 1, max: 3 },
} as const;

const boundedCount = (bounds: Readonly<{ min: number; max: number }>) =>
  v.pipe(v.number(), v.finite(), v.integer(), v.minValue(bounds.min), v.maxValue(bounds.max));

const GridSettingsSchema = readonlyObject({
  charsPerLine: boundedCount(RANGES.charsPerLine),
  linesPerStage: boundedCount(RANGES.linesPerStage),
  stagesPerPage: boundedCount(RANGES.stagesPerPage),
});

/**
 * The shape of one page of manuscript paper, counted in cells.
 */
export type GridSettings = v.InferOutput<typeof GridSettingsSchema>;

export const GridSettings = {
  schema: GridSettingsSchema,
  ranges: RANGES,

  defaults: {
    charsPerLine: 27,
    linesPerStage: 23,
    stagesPerPage: 2,
  } as const satisfies GridSettings,
} as const;
