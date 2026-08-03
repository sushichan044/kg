import * as v from "valibot";

const DiagnosticSeveritySchema = v.picklist(["warning", "error"]);

/**
 * `warning` means the stage recovered and kept going; `error` means a rule found a real defect.
 */
export type DiagnosticSeverity = v.InferOutput<typeof DiagnosticSeveritySchema>;

export const DiagnosticSeverity = { schema: DiagnosticSeveritySchema } as const;
