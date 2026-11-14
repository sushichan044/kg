import { Dialog } from "@base-ui/react/dialog";
import type { ManuscriptDiagnostic, NovelCompositionSettings } from "@sushichan044/kg-core";
import { DiagnosticList, NovelViewer, useTypography } from "@sushichan044/kg-viewer";
import type { NovelViewEvent, NovelViewHandle } from "@sushichan044/kg-viewer";
import { use, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import DownloadIcon from "~icons/lucide/download";
import FilesIcon from "~icons/lucide/files";
import DiagnosticsIcon from "~icons/lucide/message-square-warning";
import SettingsIcon from "~icons/lucide/settings-2";
import CloseIcon from "~icons/lucide/x";

import { ExportJob } from "./components/ExportJob";
import type { ExportRequest } from "./components/ExportJob";
import { IconButton } from "./components/IconButton";
import { Modal } from "./components/Modal";
import { ViewerToolbar, ZoomControls, ZOOM } from "./components/ViewerControls";
import type { FileEntry } from "./lib/api";
import { assertNever } from "./lib/assert-never";
import { processManuscript } from "./lib/processing";
import type { ProcessedManuscript, ProofreadingResult } from "./lib/processing";
import { loadPage, savePage } from "./lib/storage";
import type { ManuscriptNotation } from "./lib/storage";
import { ProcessManuscriptError } from "./manuscript";
import type { ManuscriptAction, ManuscriptState } from "./manuscript";

type SheetProps = Readonly<{
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}>;

function Sheet({ open, title, children, onClose }: SheetProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title={title}
      className="mobile-sheet"
    >
      <header className="mobile-sheet__header">
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Close aria-label={`${title}を閉じる`}>閉じる</Dialog.Close>
      </header>
      <div className="mobile-sheet__body">{open ? children : null}</div>
    </Modal>
  );
}

export function TypographyLoading() {
  return <p role="status">書体を読み込んでいます…</p>;
}

function TypographyFailure({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <div role="alert">
      <p>書体を読み込めませんでした。</p>
      <button type="button" onClick={onRetry}>
        再試行
      </button>
    </div>
  );
}

function describeFailure(
  composedSource: ProcessedManuscript["composedSource"] | null,
  proofreading: ProofreadingResult | null,
): string | null {
  if (composedSource === null) return "原稿を処理できませんでした。";
  if (!composedSource.ok) return ProcessManuscriptError.describe(composedSource.error);
  if (proofreading === null) return null;
  switch (proofreading.kind) {
    case "rule-failed": {
      return ProcessManuscriptError.describe({ stage: "proofread", error: proofreading.error });
    }
    case "crashed": {
      return `校正を実行できませんでした: ${proofreading.message}`;
    }
    case "done": {
      return null;
    }
    default: {
      return assertNever(proofreading);
    }
  }
}

type ManuscriptViewProps = Readonly<{
  file: FileEntry;
  source: string;
  manuscript: ManuscriptState;
  composition: NovelCompositionSettings;
  notation: ManuscriptNotation;
  pending: boolean;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  onFilesOpen: () => void;
  onDiagnosticSelect: (id: string) => void;
  onPreferenceAction: (action: ManuscriptAction) => void;
  renderSettings: (idPrefix: string) => ReactNode;
}>;

export function ManuscriptView({
  file,
  source,
  manuscript,
  composition,
  notation,
  pending,
  sidebarOpen,
  onSidebarToggle,
  onFilesOpen,
  onDiagnosticSelect,
  onPreferenceAction,
  renderSettings,
}: ManuscriptViewProps) {
  const typographyState = useTypography(composition.appearance.fontPreset);
  const typography = typographyState.kind === "ready" ? typographyState.typography : undefined;
  // 組版は同期、校正は Worker で行う。校正が終わるまでは Suspense で待ち、
  // 遅延値による更新では、新しい結果が揃うまで前の画面を残す
  const processed =
    typography === undefined
      ? null
      : processManuscript({ source, composition, notation, typography });
  const composedSource = processed?.composedSource ?? null;
  const proofreading = processed?.proofreading ? use(processed.proofreading) : null;
  const failure = describeFailure(composedSource, proofreading);
  const composed = failure === null && composedSource?.ok ? composedSource.value.composed : null;
  const viewerShown = composed !== null;
  const warnings = composedSource?.ok ? composedSource.value.warnings : [];
  const diagnostics =
    proofreading?.kind === "done" ? [...warnings, ...proofreading.diagnostics] : warnings;
  const activeDiagnosticId = diagnostics.some(({ id }) => id === manuscript.activeDiagnosticId)
    ? manuscript.activeDiagnosticId
    : null;
  const [zoom, setZoom] = useState(manuscript.preferences.zoom);
  const [exportRequest, setExportRequest] = useState<ExportRequest | null>(null);
  const exporting = exportRequest !== null;
  const [exportError, setExportError] = useState("");
  const [diagnosticDrawerOpen, setDiagnosticDrawerOpen] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const viewRef = useRef<NovelViewHandle>(null);

  const startExport = () => {
    if (exporting || pending || composed === null || typography === undefined) return;
    setExportError("");
    setExportRequest({
      composed,
      typography,
      startPageSide: manuscript.preferences.startPageSide,
      filename: file.path.split("/").at(-1) ?? "pages",
    });
  };

  const finishExport = (error: string | null) => {
    setExportRequest(null);
    if (error !== null) setExportError(`PNG の出力に失敗しました: ${error}`);
  };

  // 依存の source は、本文が読み込み直されたことを知るために入れている
  // workspace 全体に依存させると、SSE で一覧だけを取得し直したときにも表示位置が動く
  // viewerShown は、書体の再試行のあとでビューアーが現れたときにも位置を戻すために入れている
  useEffect(() => {
    viewRef.current?.scrollToPage(loadPage(file.path));
  }, [file.path, source, viewerShown]);

  const onViewEvent = (event: NovelViewEvent) => {
    savePage(file.path, event.page);
  };

  const changeZoom = (value: number) => {
    setZoom(value);
    onPreferenceAction({ kind: "zoom.replace", zoom: value, fit: false });
  };

  const enableFit = () => {
    onPreferenceAction({
      kind: "zoom.replace",
      zoom: manuscript.preferences.zoom,
      fit: true,
    });
  };

  const selectDiagnostic = (diagnostic: ManuscriptDiagnostic) => {
    onDiagnosticSelect(diagnostic.id);
    viewRef.current?.scrollToDiagnostic(diagnostic.id);
  };

  return (
    <>
      <ViewerToolbar
        className="desktop-viewer-toolbar"
        sidebarOpen={sidebarOpen}
        onSidebarToggle={onSidebarToggle}
        onFilesOpen={onFilesOpen}
        onExport={startExport}
        exporting={exporting || pending}
        documentLabel={file.path}
        composed={composed}
        diagnosticCount={diagnostics.length}
        zoom={zoom}
        fit={manuscript.preferences.fit}
        onZoomChange={changeZoom}
        onFitChange={enableFit}
        onDiagnosticsOpen={() => {
          setDiagnosticDrawerOpen((open) => !open);
        }}
      />
      <header className="mobile-toolbar">
        <IconButton label="ファイル" onClick={onFilesOpen}>
          <FilesIcon aria-hidden="true" />
        </IconButton>
        <div className="mobile-document">
          <strong title={file.path}>{file.path.split("/").at(-1)}</strong>
          {composed === null ? null : (
            <small>
              {composed.layout.stats.chars}字・{composed.layout.stats.pages}ページ
            </small>
          )}
        </div>
        <IconButton
          label="PNGをZIPで出力"
          disabled={exporting || pending || composed === null || typography === undefined}
          onClick={startExport}
        >
          <DownloadIcon aria-hidden="true" />
        </IconButton>
        <IconButton
          label={`診断 ${diagnostics.length}件`}
          className="diagnostics-trigger"
          onClick={() => {
            setDiagnosticDrawerOpen((open) => !open);
          }}
        >
          <DiagnosticsIcon aria-hidden="true" /> <span>{diagnostics.length}</span>
        </IconButton>
        <IconButton
          label="設定"
          onClick={() => {
            setSettingsSheetOpen(true);
          }}
        >
          <SettingsIcon aria-hidden="true" />
        </IconButton>
      </header>
      {exportError !== "" ? <p role="alert">{exportError}</p> : null}
      {typographyState.kind === "failed" ? (
        <TypographyFailure onRetry={typographyState.retry} />
      ) : composed === null ? (
        <div className="preview__failure" role="alert">
          <strong>原稿を処理できませんでした</strong>
          <p>{failure ?? "原稿を処理できませんでした。"}</p>
        </div>
      ) : (
        <NovelViewer
          ref={viewRef}
          composed={composed}
          typography={typography}
          diagnostics={diagnostics}
          activeDiagnosticId={activeDiagnosticId}
          zoom={{ value: zoom, ...ZOOM, onChange: setZoom }}
          fit={manuscript.preferences.fit}
          spread={manuscript.preferences.spread}
          startPageSide={manuscript.preferences.startPageSide}
          showGrid={manuscript.preferences.showGrid}
          onViewEvent={onViewEvent}
          onDiagnosticSelect={(diagnostic) => {
            onDiagnosticSelect(diagnostic.id);
          }}
        />
      )}

      {exportRequest !== null ? (
        <ExportJob request={exportRequest} onFinish={finishExport} />
      ) : null}

      {diagnosticDrawerOpen ? (
        <aside className="diagnostic-drawer" aria-label="診断">
          <header>
            <h2>診断</h2>
            <IconButton
              label="診断を閉じる"
              onClick={() => {
                setDiagnosticDrawerOpen(false);
              }}
            >
              <CloseIcon aria-hidden="true" />
            </IconButton>
          </header>
          <DiagnosticList
            diagnostics={diagnostics}
            activeDiagnosticId={activeDiagnosticId}
            onSelect={selectDiagnostic}
          />
        </aside>
      ) : null}

      <Sheet
        open={settingsSheetOpen}
        title="表示設定"
        onClose={() => {
          setSettingsSheetOpen(false);
        }}
      >
        {composed === null ? null : (
          <p className="mobile-summary">
            {composed.layout.stats.chars}字・{composed.layout.stats.pages}ページ
          </p>
        )}
        <ZoomControls
          className="mobile-zoom"
          zoom={zoom}
          fit={manuscript.preferences.fit}
          onZoomChange={changeZoom}
          onFitChange={enableFit}
        />
        {renderSettings("mobile-")}
      </Sheet>
    </>
  );
}
