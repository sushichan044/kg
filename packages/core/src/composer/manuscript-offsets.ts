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
 * Blank lines held back at document, page and stage scope before any text is placed.
 */
export type ManuscriptOffsets = v.InferOutput<typeof ManuscriptOffsetsSchema>;

export const ManuscriptOffsets = {
  schema: ManuscriptOffsetsSchema,
  maxDocumentOffset: MAX_DOCUMENT_OFFSET,

  defaults: {
    document: { leading: 0, trailing: 0 },
    page: { leading: 0, trailing: 0 },
    stage: { leading: 0, trailing: 0 },
  } as const satisfies ManuscriptOffsets,

  /**
   * Stage offsets must leave at least one usable line in the stage.
   */
  maxStageTotal: (flow: NovelFlowSettings): number => Math.max(0, flow.linesPerStage - 1),

  /**
   * Page offsets must leave at least one usable line on the page, after stage offsets apply.
   */
  maxPageTotal: (flow: NovelFlowSettings, stage: LineOffset): number =>
    Math.max(0, (flow.linesPerStage - LineOffset.total(stage)) * flow.stagesPerPage - 1),
} as const;
