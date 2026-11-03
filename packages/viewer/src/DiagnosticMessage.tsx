import type { ManuscriptDiagnostic } from "@sushichan044/kg-core";

export function DiagnosticMessage({ diagnostic }: Readonly<{ diagnostic: ManuscriptDiagnostic }>) {
  return (
    <div className="kgv-diagnostic-message">
      <p className="kgv-diagnostic-location">
        {diagnostic.location.start.line}行 {diagnostic.location.start.column}列
      </p>
      <p className="kgv-diagnostic-description">{diagnostic.message}</p>
    </div>
  );
}
