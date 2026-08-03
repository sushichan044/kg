import type { ProofreadingReport } from "../proofreading-report";

/**
 * Fills `{{ name }}` placeholders from the report's data; an absent key renders as empty.
 */
export function interpolate(template: string, data: ProofreadingReport["data"]): string {
  return template.replaceAll(/\{\{\s*([^}\s]+)\s*\}\}/gu, (_match, key: string) =>
    String(data?.[key] ?? ""),
  );
}
