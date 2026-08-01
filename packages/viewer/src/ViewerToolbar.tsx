import { adjacentZoomLevel, fontPreset, paperSize } from "@sushichan044/kg-core";

import { useEffectiveZoom, useManuscriptDispatch, useManuscriptState } from "./Provider";

export interface ViewerToolbarProps {
  documentLabel: string;
  documentSummary?: string;
  onDiagnosticsOpen: () => void;
  className?: string;
}

export interface ZoomControlsProps {
  verbose?: boolean;
  className?: string;
}

export function ZoomControls({ verbose = false, className }: ZoomControlsProps) {
  const zoom = useManuscriptState((state) => state.zoom);
  const dispatch = useManuscriptDispatch();
  const [effectiveZoomPercent] = useEffectiveZoom();
  const zoomOut = adjacentZoomLevel(effectiveZoomPercent, "out");
  const zoomIn = adjacentZoomLevel(effectiveZoomPercent, "in");

  return (
    <div
      className={[
        "kgv-zoom-controls",
        verbose ? "kgv-zoom-controls--verbose" : undefined,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label="表示倍率"
    >
      <button
        type="button"
        aria-label="縮小"
        disabled={zoomOut === null}
        onClick={() => {
          if (zoomOut !== null) {
            dispatch({ type: "zoom.set", zoom: { mode: "fixed", percent: zoomOut } });
          }
        }}
      >
        {verbose ? "縮小" : "−"}
      </button>
      <output>{Math.round(effectiveZoomPercent)}%</output>
      <button
        type="button"
        aria-label="拡大"
        disabled={zoomIn === null}
        onClick={() => {
          if (zoomIn !== null) {
            dispatch({ type: "zoom.set", zoom: { mode: "fixed", percent: zoomIn } });
          }
        }}
      >
        {verbose ? "拡大" : "+"}
      </button>
      <button
        type="button"
        aria-pressed={zoom.mode === "fit"}
        onClick={() => {
          dispatch({ type: "zoom.set", zoom: { mode: "fit" } });
        }}
      >
        全体表示
      </button>
    </div>
  );
}

export function ViewerToolbar({
  documentLabel,
  documentSummary,
  onDiagnosticsOpen,
  className,
}: ViewerToolbarProps) {
  const state = useManuscriptState((current) => current);
  const diagnosticCount = state.diagnostics.length;
  const summary =
    documentSummary ??
    `${paperSize(state.appearance.paperSize).label} / ${state.appearance.fontSizePt}pt / ${fontPreset(state.appearance.fontPreset).label} / ${state.settings.charsPerLine}字 × ${state.settings.linesPerStage}行 × ${state.settings.stagesPerPage}段`;

  return (
    <div className={["kgv-toolbar-container", className].filter(Boolean).join(" ")}>
      <div className="kgv-toolbar">
        <div className="kgv-toolbar-document">
          <strong className="kgv-toolbar-label" title={documentLabel}>
            {documentLabel}
          </strong>
          <span className="kgv-toolbar-summary">{summary}</span>
        </div>
        <div className="kgv-toolbar-actions">
          <ZoomControls />
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
