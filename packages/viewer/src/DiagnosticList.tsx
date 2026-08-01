import type { ManuscriptDiagnostic } from "@sushichan044/kg-core";

import { useManuscriptDispatch, useManuscriptState } from "./Provider";

export interface DiagnosticListProps {
  onSelect?: (diagnostic: ManuscriptDiagnostic) => void;
  emptyMessage?: string;
  className?: string;
}

export function DiagnosticList({
  onSelect,
  emptyMessage = "校正エラーはありません。",
  className,
}: DiagnosticListProps) {
  const { activeDiagnosticId, diagnostics } = useManuscriptState((state) => state);
  const dispatch = useManuscriptDispatch();

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
            onClick={() => {
              dispatch({ type: "diagnostic.select", id: diagnostic.id });
              onSelect?.(diagnostic);
            }}
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
