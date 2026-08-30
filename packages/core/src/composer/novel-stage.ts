import * as v from "valibot";

import { readonlyArray, readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";
import { NovelLine } from "./novel-line";

const NovelStageSchema = readonlyObject({
  range: v.nullable(ManuscriptRange.schema),
  lines: readonlyArray(NovelLine.schema),
});

export type NovelStage = v.InferOutput<typeof NovelStageSchema>;

export const NovelStage = {
  schema: NovelStageSchema,
  of: (lines: readonly NovelLine[]): NovelStage => ({
    lines,
    range: ManuscriptRange.merge(lines.map(({ range }) => range)),
  }),
} as const;
