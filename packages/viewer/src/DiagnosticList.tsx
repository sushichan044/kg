import type { ManuscriptDiagnostic } from "@sushichan044/kg-core";

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
  emptyMessage = "診断はありません。",
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
      {diagnostics.map((item) => (
        <li
          key={item.id}
          data-diagnostic-origin={item.origin.kind}
          data-diagnostic-severity={item.severity}
        >
          <button
            type="button"
            aria-current={item.id === activeDiagnosticId ? "true" : undefined}
            onClick={() => onSelect?.(item)}
          >
            <span className="kgv-diagnostic-location">
              {item.location.start.line}行 {item.location.start.column}列
            </span>
            <span>{item.message}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
