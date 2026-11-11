import * as v from "valibot";

const DiagnosticSeveritySchema = v.picklist(["warning", "error"]);

/**
 * `warning` はステージが回復して処理を続けたことを、
 * `error` はルールが実際の不備を見つけたことを表す。
 */
export type DiagnosticSeverity = v.InferOutput<typeof DiagnosticSeveritySchema>;

export const DiagnosticSeverity = { schema: DiagnosticSeveritySchema } as const;
