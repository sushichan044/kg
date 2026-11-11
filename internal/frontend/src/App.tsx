import { Dialog } from "@base-ui/react/dialog";
import type { ManuscriptDiagnostic } from "@sushichan044/kg-core";
import {
  DiagnosticList,
  NovelViewer,
  useTypography,
  TypographyStatus,
} from "@sushichan044/kg-viewer";
import type { NovelViewEvent, NovelViewHandle } from "@sushichan044/kg-viewer";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
  useRevalidator,
} from "react-router";
import DownloadIcon from "~icons/lucide/download";
import FilesIcon from "~icons/lucide/files";
import DiagnosticsIcon from "~icons/lucide/message-square-warning";
import SettingsIcon from "~icons/lucide/settings-2";
import CloseIcon from "~icons/lucide/x";

import { ExportJob } from "./components/ExportJob";
import type { ExportRequest } from "./components/ExportJob";
import { FileSwitcher } from "./components/FileSwitcher";
import { IconButton } from "./components/IconButton";
import { Modal } from "./components/Modal";
import { Sidebar } from "./components/Sidebar";
import { SettingsPanel, ViewerToolbar, ZoomControls, ZOOM } from "./components/ViewerControls";
import {
  loadManuscriptPreferences,
  loadPage,
  saveManuscriptPreferences,
  savePage,
} from "./lib/storage";
import { manuscriptReducer, ProcessManuscriptError, processManuscript } from "./manuscript";
import type { ManuscriptAction, ManuscriptState } from "./manuscript";
import { FILE_QUERY_PARAM } from "./workspace";
import type { Workspace } from "./workspace";

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

function initialManuscriptState(): ManuscriptState {
  return {
    preferences: loadManuscriptPreferences(),
    activeDiagnosticId: null,
  };
}

export function App() {
  const workspace = useLoaderData<Workspace>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const location = useLocation();
  const revalidator = useRevalidator();
  const files = workspace.files;
  const selectedFile = workspace.document?.file ?? null;
  const selectedId = selectedFile?.id ?? null;
  const selectedPath = selectedFile?.path ?? null;
  const source = workspace.document?.kind === "loaded" ? workspace.document.source : null;
  // SSE による再検証では navigation は idle のままなので、ファイルの切り替えだけが読み込み中になる
  const switching = navigation.state === "loading";
  const [manuscript, dispatch] = useReducer(manuscriptReducer, undefined, initialManuscriptState);
  const typographyState = useTypography(manuscript.preferences.composition.appearance.fontPreset);
  const typography = typographyState.kind === "ready" ? typographyState.typography : undefined;
  const processed = useMemo(
    () =>
      typography === undefined || source === null
        ? null
        : processManuscript(
            source,
            manuscript.preferences.composition,
            manuscript.preferences.notation,
            typography.composer,
          ),
    [manuscript.preferences.composition, manuscript.preferences.notation, source, typography],
  );
  const diagnostics = processed?.ok ? processed.value.diagnostics : [];
  const activeDiagnosticId = diagnostics.some(({ id }) => id === manuscript.activeDiagnosticId)
    ? manuscript.activeDiagnosticId
    : null;
  const [zoom, setZoom] = useState(manuscript.preferences.zoom);
  const [preferenceStatus, setPreferenceStatus] = useState("");
  const status = workspace.status !== "" ? workspace.status : preferenceStatus;
  const [exportRequest, setExportRequest] = useState<ExportRequest | null>(null);
  const exporting = exportRequest !== null;
  const [exportError, setExportError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [fileSwitcherOpen, setFileSwitcherOpen] = useState(false);
  const [diagnosticDrawerOpen, setDiagnosticDrawerOpen] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const viewRef = useRef<NovelViewHandle>(null);
  const manuscriptRef = useRef(manuscript);

  useEffect(() => {
    manuscriptRef.current = manuscript;
  }, [manuscript]);

  const startExport = () => {
    if (
      exporting ||
      !processed?.ok ||
      typography === undefined ||
      selectedFile === null ||
      switching
    )
      return;
    setExportError("");
    setExportRequest({
      composed: processed.value.composed,
      typography,
      startPageSide: manuscript.preferences.startPageSide,
      filename: selectedFile.path.split("/").at(-1) ?? "pages",
    });
  };

  const finishExport = useCallback((error: string | null) => {
    setExportRequest(null);
    if (error !== null) setExportError(`PNG の出力に失敗しました: ${error}`);
  }, []);

  const commitPreferenceAction = useCallback((action: ManuscriptAction) => {
    const next = manuscriptReducer(manuscriptRef.current, action);
    manuscriptRef.current = next;
    dispatch(action);
    if (!saveManuscriptPreferences(next.preferences))
      setPreferenceStatus("設定を保存できませんでした");
  }, []);

  // 依存の source は、本文が読み込み直されたことを知るために入れている
  // workspace 全体に依存させると、SSE で一覧だけを取得し直したときにも表示位置が動く
  useEffect(() => {
    if (selectedPath === null) return;
    viewRef.current?.scrollToPage(loadPage(selectedPath));
  }, [selectedPath, source]);

  const onSelect = useCallback(
    (path: string) => {
      dispatch({ kind: "diagnostic.select", id: null });
      const params = new URLSearchParams(location.search);
      params.set(FILE_QUERY_PARAM, path);
      void navigate({ search: `?${params.toString()}`, hash: location.hash }, { replace: true });
    },
    [location, navigate],
  );

  const onViewEvent = useCallback(
    (event: NovelViewEvent) => {
      if (selectedPath !== null) savePage(selectedPath, event.page);
    },
    [selectedPath],
  );

  const setFitZoom = useCallback((value: number) => {
    setZoom(value);
  }, []);

  const changeZoom = useCallback(
    (value: number) => {
      setZoom(value);
      commitPreferenceAction({ kind: "zoom.replace", zoom: value, fit: false });
    },
    [commitPreferenceAction],
  );

  const enableFit = useCallback(() => {
    commitPreferenceAction({
      kind: "zoom.replace",
      zoom: manuscriptRef.current.preferences.zoom,
      fit: true,
    });
  }, [commitPreferenceAction]);

  const selectDiagnostic = useCallback((diagnostic: ManuscriptDiagnostic) => {
    dispatch({ kind: "diagnostic.select", id: diagnostic.id });
    viewRef.current?.scrollToDiagnostic(diagnostic.id);
  }, []);

  const renderSettings = (idPrefix: string) => (
    <SettingsPanel
      idPrefix={idPrefix}
      onSpreadChange={(spread) => {
        commitPreferenceAction({ kind: "spread.replace", spread });
      }}
      onStartPageSideChange={(startPageSide) => {
        commitPreferenceAction({ kind: "start-page-side.replace", startPageSide });
      }}
      notation={manuscript.preferences.notation}
      composition={manuscript.preferences.composition}
      spread={manuscript.preferences.spread}
      startPageSide={manuscript.preferences.startPageSide}
      showGrid={manuscript.preferences.showGrid}
      status={status}
      onNotationChange={(notation) => {
        commitPreferenceAction({ kind: "notation.replace", notation });
      }}
      onCompositionChange={(composition) => {
        commitPreferenceAction({ kind: "composition.replace", composition });
      }}
      onGridChange={(showGrid) => {
        commitPreferenceAction({ kind: "grid-visibility.replace", showGrid });
      }}
    />
  );

  return (
    <div className="app" data-sidebar={sidebarOpen ? "open" : "closed"}>
      <a className="skip-link visually-hidden" href="#preview">
        プレビューへスキップ
      </a>
      <Sidebar files={files} selectedId={selectedId} onSelect={onSelect}>
        {renderSettings("desktop-")}
      </Sidebar>

      <main id="preview" className="preview" tabIndex={-1} aria-label="プレビュー">
        {selectedFile === null ? null : source === null ? (
          <div className="preview__failure preview__failure--content" role="alert">
            <p>本文を取得できませんでした</p>
            <button
              type="button"
              onClick={() => {
                void revalidator.revalidate();
              }}
            >
              再読み込み
            </button>{" "}
            <button
              type="button"
              onClick={() => {
                setFileSwitcherOpen(true);
              }}
            >
              ファイルを選ぶ
            </button>
          </div>
        ) : (
          <>
            <ViewerToolbar
              className="desktop-viewer-toolbar"
              sidebarOpen={sidebarOpen}
              onSidebarToggle={() => {
                setSidebarOpen((open) => !open);
              }}
              onFilesOpen={() => {
                setFileSwitcherOpen(true);
              }}
              onExport={startExport}
              exporting={exporting || switching}
              documentLabel={selectedFile.path}
              composed={processed?.ok ? processed.value.composed : null}
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
              <IconButton
                label="ファイル"
                onClick={() => {
                  setFileSwitcherOpen(true);
                }}
              >
                <FilesIcon aria-hidden="true" />
              </IconButton>
              <div className="mobile-document">
                <strong title={selectedFile.path}>{selectedFile.path.split("/").at(-1)}</strong>
                {processed?.ok && (
                  <small>
                    {processed.value.composed.layout.stats.chars}字・
                    {processed.value.composed.layout.stats.pages}ページ
                  </small>
                )}
              </div>
              <IconButton
                label="PNGをZIPで出力"
                disabled={exporting || !processed?.ok || typography === undefined || switching}
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
            {exportError !== "" && <p role="alert">{exportError}</p>}
            {switching ? (
              <p className="preview__loading">読み込み中…</p>
            ) : typographyState.kind !== "ready" ? (
              <TypographyStatus state={typographyState} />
            ) : processed?.ok ? (
              <NovelViewer
                ref={viewRef}
                composed={processed.value.composed}
                typography={typography}
                diagnostics={diagnostics}
                activeDiagnosticId={activeDiagnosticId}
                zoom={{ value: zoom, ...ZOOM, onChange: setFitZoom }}
                fit={manuscript.preferences.fit}
                spread={manuscript.preferences.spread}
                startPageSide={manuscript.preferences.startPageSide}
                showGrid={manuscript.preferences.showGrid}
                onViewEvent={onViewEvent}
                onDiagnosticSelect={(diagnostic) => {
                  dispatch({ kind: "diagnostic.select", id: diagnostic.id });
                }}
              />
            ) : (
              <div className="preview__failure" role="alert">
                <strong>原稿を処理できませんでした</strong>
                <p>
                  {processed === null
                    ? "原稿を処理できませんでした。"
                    : ProcessManuscriptError.describe(processed.error)}
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {exportRequest !== null && <ExportJob request={exportRequest} onFinish={finishExport} />}

      {diagnosticDrawerOpen && (
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
      )}

      <FileSwitcher
        open={fileSwitcherOpen}
        onOpenChange={setFileSwitcherOpen}
        files={files}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      <Sheet
        open={settingsSheetOpen}
        title="表示設定"
        onClose={() => {
          setSettingsSheetOpen(false);
        }}
      >
        {processed?.ok && (
          <p className="mobile-summary">
            {processed.value.composed.layout.stats.chars}字・
            {processed.value.composed.layout.stats.pages}ページ
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
    </div>
  );
}
