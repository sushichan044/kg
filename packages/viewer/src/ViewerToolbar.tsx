import { adjacentZoomLevel } from "@sushichan044/kg-core";
import type { ZoomMode } from "@sushichan044/kg-core";

export interface ViewerToolbarProps {
  documentLabel: string;
  documentSummary?: string;
  zoom: ZoomMode;
  effectiveZoomPercent: number;
  diagnosticCount: number;
  onZoomChange: (zoom: ZoomMode) => void;
  onDiagnosticsOpen: () => void;
  className?: string;
}

export function ViewerToolbar({
  documentLabel,
  documentSummary,
  zoom,
  effectiveZoomPercent,
  diagnosticCount,
  onZoomChange,
  onDiagnosticsOpen,
  className,
}: ViewerToolbarProps) {
  const zoomOut = adjacentZoomLevel(effectiveZoomPercent, "out");
  const zoomIn = adjacentZoomLevel(effectiveZoomPercent, "in");

  return (
    <div className={["kgv-toolbar-container", className].filter(Boolean).join(" ")}>
      <div className="kgv-toolbar">
        <div className="kgv-toolbar-document">
          <strong className="kgv-toolbar-label" title={documentLabel}>
            {documentLabel}
          </strong>
          {documentSummary !== undefined && (
            <span className="kgv-toolbar-summary">{documentSummary}</span>
          )}
        </div>
        <div className="kgv-toolbar-actions">
          <div className="kgv-zoom-controls" role="group" aria-label="表示倍率">
            <button
              type="button"
              aria-label="縮小"
              disabled={zoomOut === null}
              onClick={() => {
                if (zoomOut !== null) {
                  onZoomChange({ mode: "fixed", percent: zoomOut });
                }
              }}
            >
              −
            </button>
            <output>{Math.round(effectiveZoomPercent)}%</output>
            <button
              type="button"
              aria-label="拡大"
              disabled={zoomIn === null}
              onClick={() => {
                if (zoomIn !== null) {
                  onZoomChange({ mode: "fixed", percent: zoomIn });
                }
              }}
            >
              +
            </button>
            <button
              type="button"
              aria-pressed={zoom.mode === "fit"}
              onClick={() => onZoomChange({ mode: "fit" })}
            >
              全体表示
            </button>
          </div>
          <button
            type="button"
            className="kgv-diagnostics-trigger"
            aria-label={`校正エラー ${diagnosticCount}件`}
            onClick={onDiagnosticsOpen}
          >
            校正 <span aria-hidden="true">{diagnosticCount}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
