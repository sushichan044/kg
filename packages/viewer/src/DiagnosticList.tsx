import type { ManuscriptDiagnostic } from "@sushichan044/kg-core";

export interface DiagnosticListProps {
  diagnostics: ManuscriptDiagnostic[];
  activeDiagnosticId?: string | null;
  onSelect: (diagnostic: ManuscriptDiagnostic) => void;
  emptyMessage?: string;
  className?: string;
}

export function DiagnosticList({
  diagnostics,
  activeDiagnosticId = null,
  onSelect,
  emptyMessage = "校正エラーはありません。",
  className,
}: DiagnosticListProps) {
  if (diagnostics.length === 0) {
    return (
      <p className={["kgv-diagnostics-empty", className].filter(Boolean).join(" ")}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <ol className={["kgv-diagnostics", className].filter(Boolean).join(" ")}>
      {diagnostics.map((diagnostic) => (
        <li key={diagnostic.id}>
          <button
            type="button"
            aria-current={diagnostic.id === activeDiagnosticId ? "true" : undefined}
            onClick={() => onSelect(diagnostic)}
          >
            <span className="kgv-diagnostic-location">
              {diagnostic.location.start.line}行 {diagnostic.location.start.column}列
            </span>
            <span>{diagnostic.message}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
