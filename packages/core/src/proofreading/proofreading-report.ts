import * as v from "valibot";

import { DiagnosticSeverity } from "../diagnostic/diagnostic-severity";
import { readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";

const ProofreadingReportSchema = readonlyObject({
  range: ManuscriptRange.schema,
  messageId: v.string(),
  data: v.optional(v.pipe(v.record(v.string(), v.union([v.string(), v.number()])), v.readonly())),
  /**
   * 省略すると `error` として扱う。何も言わないルールは、
   * 実際の不備を見つけたと主張しているからである。
   */
  severity: v.optional(DiagnosticSeverity.schema),
});

/**
 * ルールが 1 件の指摘について返すもの。ルールは自分でテキストを整形せず、
 * 宣言済みのメッセージを名前で指定する。そのため、同じルールをどの言語でも提示できる。
 */
export type ProofreadingReport = v.InferOutput<typeof ProofreadingReportSchema>;

export const ProofreadingReport = { schema: ProofreadingReportSchema } as const;
