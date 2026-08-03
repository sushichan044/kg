import * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";

const ProofreadingReportSchema = readonlyObject({
  range: ManuscriptRange.schema,
  messageId: v.string(),
  data: v.optional(v.pipe(v.record(v.string(), v.union([v.string(), v.number()])), v.readonly())),
});

/**
 * What a rule hands back for one finding. The rule names a message it declared rather than
 * formatting text itself, so the same rule can be presented in any language.
 */
export type ProofreadingReport = v.InferOutput<typeof ProofreadingReportSchema>;

export const ProofreadingReport = { schema: ProofreadingReportSchema } as const;
