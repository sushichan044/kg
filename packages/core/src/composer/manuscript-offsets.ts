import type * as v from "valibot";

import { nonNegativeInteger, readonlyObject } from "../internal/schema";
import { LineOffset } from "./line-offset";
import type { NovelFlowSettings } from "./novel-flow-settings";

const MAX_DOCUMENT_OFFSET = 10_000;

const ManuscriptOffsetsSchema = readonlyObject({
  document: readonlyObject({
    leading: nonNegativeInteger(MAX_DOCUMENT_OFFSET),
    trailing: nonNegativeInteger(MAX_DOCUMENT_OFFSET),
  }),
  page: LineOffset.schema,
  stage: LineOffset.schema,
});

/**
 * 文字を配置する前に、文書・ページ・段の単位で確保しておく空き行。小説が冒頭のページを空けたり、
 * 各段の天地を空けたりするのはこの仕組みによる。ミリメートルではなく行単位で確保するので、
 * グリッドが崩れない。
 */
export type ManuscriptOffsets = v.InferOutput<typeof ManuscriptOffsetsSchema>;

export const ManuscriptOffsets = {
  schema: ManuscriptOffsetsSchema,

  defaults: {
    document: { leading: 0, trailing: 0 },
    page: { leading: 0, trailing: 0 },
    stage: { leading: 0, trailing: 0 },
  } as const satisfies ManuscriptOffsets,

  /**
   * 段のオフセットは、段内に使える行を少なくとも1行残さなければならない。
   */
  maxStageTotal: (flow: NovelFlowSettings): number => Math.max(0, flow.linesPerStage - 1),

  /**
   * ページのオフセットは、段のオフセットを適用した後で、
   * ページに使える行を少なくとも1行残さなければならない。
   */
  maxPageTotal: (flow: NovelFlowSettings, stage: LineOffset): number =>
    Math.max(0, (flow.linesPerStage - LineOffset.total(stage)) * flow.stagesPerPage - 1),
} as const;
