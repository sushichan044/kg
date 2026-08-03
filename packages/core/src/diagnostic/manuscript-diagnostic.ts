import * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";
import { SourcePosition } from "../range/source-position";
import { DiagnosticOrigin } from "./diagnostic-origin";
import { DiagnosticSeverity } from "./diagnostic-severity";

const ManuscriptDiagnosticSchema = readonlyObject({
  id: v.string(),
  origin: DiagnosticOrigin.schema,
  severity: DiagnosticSeverity.schema,
  message: v.string(),
  range: ManuscriptRange.schema,
  location: readonlyObject({ start: SourcePosition.schema, end: SourcePosition.schema }),
});

/**
 * One finding, carrying both the three-way range and the line/column the viewer displays.
 */
export type ManuscriptDiagnostic = v.InferOutput<typeof ManuscriptDiagnosticSchema>;

export type ManuscriptDiagnosticInput = Readonly<{
  source: string;
  origin: DiagnosticOrigin;
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  range: ManuscriptRange;
}>;

export const ManuscriptDiagnostic = {
  schema: ManuscriptDiagnosticSchema,

  of: ({
    source,
    origin,
    severity,
    code,
    message,
    range,
  }: ManuscriptDiagnosticInput): ManuscriptDiagnostic => ({
    id: `${origin.kind}:${origin.id}:${code}:${range.source.start}:${range.source.end}`,
    origin,
    severity,
    message,
    range,
    location: {
      start: SourcePosition.at(source, range.source.start),
      end: SourcePosition.at(source, range.source.end),
    },
  }),

  /**
   * Stable order for display: by source span, then by producing plugin.
   */
  compare: (left: ManuscriptDiagnostic, right: ManuscriptDiagnostic): number =>
    left.range.source.start - right.range.source.start ||
    left.range.source.end - right.range.source.end ||
    left.origin.id.localeCompare(right.origin.id),
} as const;
