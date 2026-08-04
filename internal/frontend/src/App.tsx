import type { ManuscriptDiagnostic } from "@sushichan044/kg-core";
import { DiagnosticList, ManuscriptViewer } from "@sushichan044/kg-viewer";
import type { ManuscriptViewEvent, ManuscriptViewHandle } from "@sushichan044/kg-viewer";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";

import { FilePanel, Sidebar } from "./components/Sidebar";
import { SettingsPanel, ViewerToolbar, ZoomControls } from "./components/ViewerControls";
import { useServerEvents } from "./hooks/useServerEvents";
import { fetchContent, fetchFiles } from "./lib/api";
import type { FileEntry } from "./lib/api";
import {
  loadAppState,
  loadManuscriptPreferences,
  loadPage,
  saveAppState,
  saveManuscriptPreferences,
  savePage,
} from "./lib/storage";
import type { AppState } from "./lib/storage";
import { manuscriptReducer, ProcessManuscriptError, processManuscript } from "./manuscript";
import type { ManuscriptAction, ManuscriptState } from "./manuscript";

type SheetProps = Readonly<{
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}>;

function Sheet({ open, title, children, onClose }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const dismissBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) event.currentTarget.close();
  };

  return (
    <dialog
      ref={ref}
      className="mobile-sheet"
      aria-label={title}
      onClose={onClose}
      onClick={dismissBackdrop}
    >
      <header className="mobile-sheet__header">
        <h2>{title}</h2>
        <button type="button" aria-label={`${title}を閉じる`} onClick={() => ref.current?.close()}>
          閉じる
        </button>
      </header>
      <div className="mobile-sheet__body">{children}</div>
    </dialog>
  );
}

const FILE_QUERY_PARAM = "file";

function loadInitialAppState(): AppState {
  const stored = loadAppState();
  const selectedPath = new URL(window.location.href).searchParams.get(FILE_QUERY_PARAM);
  return selectedPath === null || selectedPath === "" ? stored : { version: 1, selectedPath };
}

function replaceSelectedPathInURL(path: string | null): void {
  const url = new URL(window.location.href);
  if (path === null) url.searchParams.delete(FILE_QUERY_PARAM);
  else url.searchParams.set(FILE_QUERY_PARAM, path);
  window.history.replaceState(window.history.state, "", url);
}

function resolveAppState(files: readonly FileEntry[], current: AppState): AppState {
  const selectedPath =
    files.find((file) => file.path === current.selectedPath)?.path ?? files[0]?.path ?? null;
  return selectedPath === current.selectedPath ? current : { version: 1, selectedPath };
}

function initialManuscriptState(): ManuscriptState {
  return {
    source: "",
    preferences: loadManuscriptPreferences(),
    activeDiagnosticId: null,
  };
}

function Workspace() {
  const [manuscript, dispatch] = useReducer(manuscriptReducer, undefined, initialManuscriptState);
  const processed = useMemo(
    () => processManuscript(manuscript.source, manuscript.preferences.composition),
    [manuscript.preferences.composition, manuscript.source],
  );
  const diagnostics = processed.ok ? processed.value.diagnostics : [];
  const activeDiagnosticId = diagnostics.some(({ id }) => id === manuscript.activeDiagnosticId)
    ? manuscript.activeDiagnosticId
    : null;
  const [zoom, setZoom] = useState(manuscript.preferences.zoom);
  const [appState, setAppState] = useState(loadInitialAppState);
  const [files, setFiles] = useState<readonly FileEntry[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [loadedDocument, setLoadedDocument] = useState<{ id: string } | null>(null);
  const [status, setStatus] = useState("");
  const [diagnosticDrawerOpen, setDiagnosticDrawerOpen] = useState(false);
  const [filesSheetOpen, setFilesSheetOpen] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [diagnosticsSheetOpen, setDiagnosticsSheetOpen] = useState(false);
  const viewRef = useRef<ManuscriptViewHandle>(null);
  const appStateRef = useRef(appState);
  const manuscriptRef = useRef(manuscript);
  const catalogRequestRef = useRef(0);
  const contentRequestRef = useRef(0);

  useEffect(() => {
    manuscriptRef.current = manuscript;
  }, [manuscript]);

  const selectedFile =
    files.find((file) => file.path === appState.selectedPath) ?? files[0] ?? null;
  const selectedId = selectedFile?.id ?? null;
  const selectedPath = selectedFile?.path ?? null;

  const commitAppState = useCallback((next: AppState) => {
    appStateRef.current = next;
    setAppState(next);
    if (!saveAppState(next)) setStatus("選択状態を保存できませんでした");
  }, []);

  const commitPreferenceAction = useCallback((action: ManuscriptAction) => {
    const next = manuscriptReducer(manuscriptRef.current, action);
    manuscriptRef.current = next;
    dispatch(action);
    if (!saveManuscriptPreferences(next.preferences)) setStatus("設定を保存できませんでした");
  }, []);

  const acceptCatalogResponse = useCallback(
    (request: number, nextFiles: readonly FileEntry[]) => {
      if (request !== catalogRequestRef.current) return;
      setFiles(nextFiles);
      commitAppState(resolveAppState(nextFiles, appStateRef.current));
      setCatalogLoaded(true);
    },
    [commitAppState],
  );

  const refreshFiles = useCallback(async () => {
    const request = ++catalogRequestRef.current;
    try {
      acceptCatalogResponse(request, await fetchFiles());
    } catch {
      if (request === catalogRequestRef.current) setStatus("ファイル一覧の取得に失敗しました");
    }
  }, [acceptCatalogResponse]);

  const loadContent = useCallback((id: string) => {
    const request = ++contentRequestRef.current;
    return fetchContent(id).then(
      (text) => {
        if (request !== contentRequestRef.current) return;
        dispatch({ kind: "document.replace", text });
        setLoadedDocument({ id });
      },
      () => {
        if (request === contentRequestRef.current) setStatus("本文の取得に失敗しました");
      },
    );
  }, []);

  useEffect(() => {
    const request = ++catalogRequestRef.current;
    void fetchFiles().then(
      (nextFiles) => {
        acceptCatalogResponse(request, nextFiles);
      },
      () => {
        if (request === catalogRequestRef.current) setStatus("ファイル一覧の取得に失敗しました");
      },
    );
    return () => {
      catalogRequestRef.current += 1;
    };
  }, [acceptCatalogResponse]);

  useEffect(() => {
    if (catalogLoaded) replaceSelectedPathInURL(selectedPath);
  }, [catalogLoaded, selectedPath]);

  useEffect(() => {
    if (selectedId === null) {
      contentRequestRef.current += 1;
      dispatch({ kind: "document.replace", text: "" });
      return;
    }
    void loadContent(selectedId);
  }, [loadContent, selectedId]);

  useEffect(() => {
    if (loadedDocument === null || loadedDocument.id !== selectedId || selectedPath === null)
      return;
    viewRef.current?.scrollToPage(loadPage(selectedPath));
  }, [loadedDocument, selectedId, selectedPath]);

  useServerEvents({
    onCatalogChanged: () => {
      void refreshFiles();
      setStatus("ファイル一覧を更新しました");
    },
    onFileChanged: (id) => {
      if (id === selectedId) void loadContent(id);
    },
  });

  const onSelect = useCallback(
    (id: string) => {
      const found = files.find((file) => file.id === id);
      if (found !== undefined) commitAppState({ version: 1, selectedPath: found.path });
      setFilesSheetOpen(false);
    },
    [commitAppState, files],
  );

  const onViewEvent = useCallback(
    (event: ManuscriptViewEvent) => {
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
    setDiagnosticsSheetOpen(false);
  }, []);

  const settings = processed.ok ? (
    <SettingsPanel
      composition={manuscript.preferences.composition}
      composed={processed.value.composed}
      presets={manuscript.preferences.presets}
      status={status}
      onCompositionChange={(composition) => {
        commitPreferenceAction({ kind: "composition.replace", composition });
      }}
      onPresetApply={(preset) => {
        commitPreferenceAction({ kind: "preset.apply", preset });
      }}
      onPresetSave={(preset) => {
        commitPreferenceAction({ kind: "preset.save", preset });
      }}
      onPresetDelete={(name) => {
        commitPreferenceAction({ kind: "preset.delete", name });
      }}
    />
  ) : null;

  return (
    <div className={diagnosticDrawerOpen ? "app app--diagnostics" : "app"}>
      <a className="skip-link visually-hidden" href="#preview">
        プレビューへスキップ
      </a>
      <Sidebar files={files} selectedId={selectedId} onSelect={onSelect} status={status}>
        {processed.ok ? (
          <SettingsPanel
            idPrefix="desktop-"
            composition={manuscript.preferences.composition}
            composed={processed.value.composed}
            presets={manuscript.preferences.presets}
            status={status}
            onCompositionChange={(composition) => {
              commitPreferenceAction({ kind: "composition.replace", composition });
            }}
            onPresetApply={(preset) => {
              commitPreferenceAction({ kind: "preset.apply", preset });
            }}
            onPresetSave={(preset) => {
              commitPreferenceAction({ kind: "preset.save", preset });
            }}
            onPresetDelete={(name) => {
              commitPreferenceAction({ kind: "preset.delete", name });
            }}
          />
        ) : null}
      </Sidebar>

      <main id="preview" className="preview" tabIndex={-1} aria-label="プレビュー">
        {selectedFile === null ? (
          <p className="preview__empty">監視対象の .txt ファイルがありません。</p>
        ) : (
          <>
            {processed.ok && (
              <ViewerToolbar
                className="desktop-viewer-toolbar"
                documentLabel={selectedFile.path}
                composed={processed.value.composed}
                diagnosticCount={diagnostics.length}
                zoom={zoom}
                fit={manuscript.preferences.fit}
                onZoomChange={changeZoom}
                onFitChange={enableFit}
                onDiagnosticsOpen={() => {
                  setDiagnosticDrawerOpen((open) => !open);
                }}
              />
            )}
            <header className="mobile-toolbar">
              <button
                type="button"
                onClick={() => {
                  setFilesSheetOpen(true);
                }}
              >
                ファイル
              </button>
              <strong title={selectedFile.path}>{selectedFile.path}</strong>
              <button
                type="button"
                aria-label={`診断 ${diagnostics.length}件`}
                onClick={() => {
                  setDiagnosticsSheetOpen(true);
                }}
              >
                診断 <span>{diagnostics.length}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsSheetOpen(true);
                }}
              >
                設定
              </button>
            </header>
            {loadedDocument?.id !== selectedId ? (
              <p className="preview__loading">読み込み中…</p>
            ) : processed.ok ? (
              <ManuscriptViewer
                ref={viewRef}
                composed={processed.value.composed}
                diagnostics={diagnostics}
                activeDiagnosticId={activeDiagnosticId}
                zoom={{ value: zoom, min: 50, max: 150, step: 25, onChange: setFitZoom }}
                fit={manuscript.preferences.fit}
                onViewEvent={onViewEvent}
                onDiagnosticSelect={(diagnostic) => {
                  dispatch({ kind: "diagnostic.select", id: diagnostic.id });
                  if (window.matchMedia("(max-width: 52rem)").matches) {
                    setDiagnosticsSheetOpen(true);
                  } else {
                    setDiagnosticDrawerOpen(true);
                  }
                }}
              />
            ) : (
              <div className="preview__failure" role="alert">
                <strong>原稿を処理できませんでした。</strong>
                <p>{ProcessManuscriptError.describe(processed.error)}</p>
              </div>
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
        open={filesSheetOpen}
        title="ファイル"
        onClose={() => {
          setFilesSheetOpen(false);
        }}
      >
        <FilePanel files={files} selectedId={selectedId} onSelect={onSelect} />
      </Sheet>
      <Sheet
        open={settingsSheetOpen}
        title="表示設定"
        onClose={() => {
          setSettingsSheetOpen(false);
        }}
      >
        <ZoomControls
          verbose
          className="mobile-zoom"
          zoom={zoom}
          fit={manuscript.preferences.fit}
          onZoomChange={changeZoom}
          onFitChange={enableFit}
        />
        {settings}
      </Sheet>
      <Sheet
        open={diagnosticsSheetOpen}
        title="診断"
        onClose={() => {
          setDiagnosticsSheetOpen(false);
        }}
      >
        <DiagnosticList
          diagnostics={diagnostics}
          activeDiagnosticId={activeDiagnosticId}
          onSelect={selectDiagnostic}
        />
      </Sheet>
    </div>
  );
}

export function App() {
  return <Workspace />;
}
