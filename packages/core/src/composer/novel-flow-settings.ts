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

/**
 * The text grid of one page, in the terms a Japanese book is specified in: `lineLengthEm` is the
 * characters per line (字詰め), `linesPerStage` the lines in one block of text (行数), and
 * `stagesPerPage` how many such blocks a page is divided into (段組).
 *
 * These are counts of em cells, not physical lengths. `ManuscriptGeometry` turns them into
 * millimetres once a paper size and a font size are known.
 */
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
