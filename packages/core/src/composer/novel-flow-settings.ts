import * as v from "valibot";

import { A5_PAGE_FORMAT } from "../appearance/a5-page-format";
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
 * 1ページ分の版面のグリッドを、日本の書籍の仕様と同じ言い方で表す。`lineLengthEm` は1行の字詰め、
 * `linesPerStage` は1段の行数、`stagesPerPage` はページを何段に分けるか（段組）を表す。
 *
 * これらは全角を単位とする数であり、物理的な長さではない。用紙サイズと文字サイズが決まると、
 * `ManuscriptGeometry` がミリメートルに換算する。
 */
export type NovelFlowSettings = v.InferOutput<typeof NovelFlowSettingsSchema>;

export const NovelFlowSettings = {
  schema: NovelFlowSettingsSchema,
  ranges: RANGES,

  defaults: A5_PAGE_FORMAT.flow satisfies NovelFlowSettings,
} as const;
