import type { ProofreadingReport } from "../proofreading-report";

/**
 * `{{ name }}` のプレースホルダーを、レポートのデータで埋める。キーが無ければ空文字列になる。
 */
export function interpolate(template: string, data: ProofreadingReport["data"]): string {
  return template.replaceAll(/\{\{\s*([^}\s]+)\s*\}\}/gu, (_match, key: string) =>
    String(data?.[key] ?? ""),
  );
}
