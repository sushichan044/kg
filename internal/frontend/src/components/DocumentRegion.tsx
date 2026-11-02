import type { ManuscriptDiagnostic } from "@sushichan044/kg-core";
import { DiagnosticList, NovelViewer, TypographyStatus } from "@sushichan044/kg-viewer";
import type {
  NovelViewEvent,
  NovelViewHandle,
  ReadyTypography,
  TypographyState,
} from "@sushichan044/kg-viewer";
import { useLayoutEffect, useRef, useState } from "react";
import type { Dispatch, ReactNode, RefObject } from "react";

import type { FileEntry } from "../lib/api";
import { loadPage, savePage } from "../lib/storage";
import type { ManuscriptPreferences } from "../lib/storage";
import type { PreferenceAction, ProcessedManuscript } from "../manuscript";
import { Sheet } from "./Sheet";
import type { MobileSheet } from "./Sheet";
import { ViewerToolbar } from "./ViewerControls";

export type PreviewState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{
      kind: "typography";
      state: Exclude<TypographyState, { kind: "ready" }> & { retry: () => void };
    }>
  | Readonly<{ kind: "failed"; message: string; retry: boolean }>
  | Readonly<{
      kind: "ready";
      processed: ProcessedManuscript;
      typography: ReadyTypography;
      refreshFailed: boolean;
    }>;

export type DocumentRegionProps = Readonly<{
  selectedFile: FileEntry | null;
  preferences: ManuscriptPreferences;
  dispatch: Dispatch<PreferenceAction>;
  sheet: MobileSheet;
  setSheet: (sheet: MobileSheet) => void;
  diagnosticDrawerOpen: boolean;
  setDiagnosticDrawerOpen: (open: boolean) => void;
  fitZoom: number;
  setFitZoom: (value: number) => void;
  refreshContent: () => void;
  preview: PreviewState;
}>;

function ReadyPreview({
  path,
  viewRef,
  children,
}: Readonly<{ path: string; viewRef: RefObject<NovelViewHandle | null>; children: ReactNode }>) {
  useLayoutEffect(() => {
    viewRef.current?.scrollToPage(loadPage(path));
  }, [path, viewRef]);
  return children;
}

export function DocumentRegion({
  selectedFile,
  preferences,
  dispatch,
  sheet,
  setSheet,
  diagnosticDrawerOpen,
  setDiagnosticDrawerOpen,
  fitZoom,
  setFitZoom,
  refreshContent,
  preview,
}: DocumentRegionProps) {
  const viewRef = useRef<NovelViewHandle>(null);
  const processed = preview.kind === "ready" ? preview.processed : null;
  const [activeDiagnosticId, setActiveDiagnosticId] = useState<string | null>(null);
  const diagnostics = processed?.diagnostics ?? [];
  const zoom = preferences.fit ? fitZoom : preferences.zoom;
  const changeZoom = (value: number) => {
    dispatch({ kind: "zoom.replace", zoom: value, fit: false });
  };
  const enableFit = () => {
    dispatch({ kind: "zoom.replace", zoom: preferences.zoom, fit: true });
  };
  const selectDiagnostic = (diagnostic: ManuscriptDiagnostic) => {
    setActiveDiagnosticId(diagnostic.id);
    viewRef.current?.scrollToDiagnostic(diagnostic.id);
    setSheet(null);
  };
  const onViewEvent = (event: NovelViewEvent) => {
    if (selectedFile !== null) savePage(selectedFile.path, event.page);
  };
  return (
    <>
      <main id="preview" className="preview" tabIndex={-1} aria-label="プレビュー">
        {selectedFile === null ? null : (
          <>
            <div>
              {processed !== null && (
                <ViewerToolbar
                  className="desktop-viewer-toolbar"
                  documentLabel={selectedFile.path}
                  composed={processed.composed}
                  diagnosticCount={diagnostics.length}
                  zoom={zoom}
                  fit={preferences.fit}
                  onZoomChange={changeZoom}
                  onFitChange={enableFit}
                  onDiagnosticsOpen={() => {
                    setDiagnosticDrawerOpen(!diagnosticDrawerOpen);
                  }}
                />
              )}
              <header className="mobile-toolbar">
                <button
                  type="button"
                  onClick={() => {
                    setSheet("files");
                  }}
                >
                  ファイル
                </button>
                <strong title={selectedFile.path}>{selectedFile.path}</strong>
                <button
                  type="button"
                  aria-label={`診断 ${diagnostics.length}件`}
                  onClick={() => {
                    setSheet("diagnostics");
                  }}
                >
                  診断 <span>{diagnostics.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSheet("settings");
                  }}
                >
                  設定
                </button>
              </header>
              {preview.kind === "ready" && preview.refreshFailed && (
                <div role="alert">
                  <p>本文の取得に失敗しました</p>
                  <button type="button" onClick={refreshContent}>
                    再試行
                  </button>
                </div>
              )}
            </div>
            {preview.kind === "loading" && (
              <p className="preview__loading" role="status">
                読み込み中…
              </p>
            )}
            {preview.kind === "typography" && <TypographyStatus state={preview.state} />}
            {preview.kind === "failed" && (
              <div className="preview__failure" role="alert">
                <p>{preview.message}</p>
                {preview.retry && (
                  <button type="button" onClick={refreshContent}>
                    再試行
                  </button>
                )}
              </div>
            )}
            {preview.kind === "ready" && (
              <ReadyPreview path={selectedFile.path} viewRef={viewRef}>
                <NovelViewer
                  ref={viewRef}
                  composed={preview.processed.composed}
                  typography={preview.typography}
                  diagnostics={diagnostics}
                  activeDiagnosticId={activeDiagnosticId}
                  zoom={{ value: zoom, min: 50, max: 150, step: 25, onChange: setFitZoom }}
                  fit={preferences.fit}
                  showGrid={preferences.showGrid}
                  onViewEvent={onViewEvent}
                  onDiagnosticSelect={(diagnostic) => {
                    setActiveDiagnosticId(diagnostic.id);
                    if (window.matchMedia("(max-width: 52rem)").matches) setSheet("diagnostics");
                    else setDiagnosticDrawerOpen(true);
                  }}
                />
              </ReadyPreview>
            )}
          </>
        )}
      </main>
      {diagnosticDrawerOpen && (
        <aside className="diagnostic-drawer" aria-label="診断">
          <header>
            <h2>診断</h2>
            <button
              type="button"
              aria-label="診断を閉じる"
              onClick={() => {
                setDiagnosticDrawerOpen(false);
              }}
            >
              閉じる
            </button>
          </header>
          <DiagnosticList
            diagnostics={diagnostics}
            activeDiagnosticId={activeDiagnosticId}
            onSelect={selectDiagnostic}
          />
        </aside>
      )}
      <Sheet
        open={sheet === "diagnostics"}
        title="診断"
        onClose={() => {
          setSheet(null);
        }}
      >
        <DiagnosticList
          diagnostics={diagnostics}
          activeDiagnosticId={activeDiagnosticId}
          onSelect={selectDiagnostic}
        />
      </Sheet>
    </>
  );
}
