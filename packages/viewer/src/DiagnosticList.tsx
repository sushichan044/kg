import type { ManuscriptDiagnostic } from "@sushichan044/kg-core";

import { DiagnosticMessage } from "./DiagnosticMessage";

export type DiagnosticListProps = Readonly<{
  diagnostics: readonly ManuscriptDiagnostic[];
  activeDiagnosticId?: string | null;
  onSelect?: (diagnostic: ManuscriptDiagnostic) => void;
  emptyMessage?: string;
  className?: string;
}>;

export function DiagnosticList({
  diagnostics,
  activeDiagnosticId = null,
  onSelect,
  emptyMessage = "",
  className,
}: DiagnosticListProps) {
  if (diagnostics.length === 0) {
    if (emptyMessage === "") return null;
    return (
      <p className={["kgv-diagnostics-empty", className].filter(Boolean).join(" ")}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <ol className={["kgv-diagnostics", className].filter(Boolean).join(" ")}>
      {diagnostics.map((item) => (
        <li
          key={item.id}
          data-diagnostic-origin={item.origin.kind}
          data-diagnostic-severity={item.severity}
        >
          <DiagnosticMessage diagnostic={item} />
          {onSelect !== undefined && (
            <button
              type="button"
              className="kgv-diagnostic-jump"
              aria-label={`${item.location.start.line}行${item.location.start.column}列の本文へ移動`}
              aria-current={item.id === activeDiagnosticId ? "true" : undefined}
              onClick={() => {
                onSelect(item);
              }}
            >
              本文へ移動
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}
