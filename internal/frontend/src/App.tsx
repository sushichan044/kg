import { createManuscript } from "@sushichan044/kg-core";
import type { ManuscriptController, ManuscriptDiagnostic } from "@sushichan044/kg-core";
import {
  DiagnosticList,
  IframeIsolation,
  ManuscriptProvider,
  ManuscriptViewer,
  SettingsPanel,
  ViewerToolbar,
  ZoomControls,
  useManuscriptState,
} from "@sushichan044/kg-viewer";
import type { ManuscriptViewHandle, ManuscriptViewEvent } from "@sushichan044/kg-viewer";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";

import { FilePanel, Sidebar } from "./components/Sidebar";
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

interface SheetProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

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

interface WorkspaceProps {
  controller: ManuscriptController;
}

function Workspace({ controller }: WorkspaceProps) {
  const diagnosticCount = useManuscriptState((state) => state.diagnostics.length);
  const [appState, setAppState] = useState(loadAppState);
  const [files, setFiles] = useState<FileEntry[]>([]);
  // A new object per successful load, so page restoration also runs when the same
  // document is reloaded after a file-change event.
  const [loadedDocument, setLoadedDocument] = useState<{ id: string } | null>(null);
  const [status, setStatus] = useState("");
  const [diagnosticDrawerOpen, setDiagnosticDrawerOpen] = useState(false);
  const [filesSheetOpen, setFilesSheetOpen] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [diagnosticsSheetOpen, setDiagnosticsSheetOpen] = useState(false);
  const viewRef = useRef<ManuscriptViewHandle>(null);
  // Identifies the newest content request so a late response cannot overwrite a newer one.
  const contentRequestRef = useRef(0);

  const selectedFile =
    files.find((file) => file.path === appState.selectedPath) ?? files[0] ?? null;
  const selectedId = selectedFile?.id ?? null;
  const selectedPath = selectedFile?.path ?? null;

  const refreshFiles = useCallback(async () => {
    try {
      setFiles(await fetchFiles());
    } catch {
      setStatus("ファイル一覧の取得に失敗しました");
    }
  }, []);

  const loadContent = useCallback(
    (id: string) => {
      const request = ++contentRequestRef.current;
      return fetchContent(id).then(
        (text) => {
          if (request !== contentRequestRef.current) return;
          controller.dispatch({ type: "document.replace", text });
          setLoadedDocument({ id });
        },
        () => {
          if (request === contentRequestRef.current) setStatus("本文の取得に失敗しました");
        },
      );
    },
    [controller],
  );

  useEffect(() => {
    let ignore = false;
    void fetchFiles().then(
      (nextFiles) => {
        if (!ignore) setFiles(nextFiles);
      },
      () => {
        if (!ignore) setStatus("ファイル一覧の取得に失敗しました");
      },
    );
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (selectedId === null) {
      contentRequestRef.current += 1;
      controller.dispatch({ type: "document.replace", text: "" });
      return;
    }
    void loadContent(selectedId);
  }, [controller, loadContent, selectedId]);

  // Restoration runs after the viewer commits, so viewRef is bound by the time it scrolls.
  useEffect(() => {
    if (loadedDocument === null || loadedDocument.id !== selectedId || selectedPath === null) {
      return;
    }
    viewRef.current?.scrollToPage(loadPage(selectedPath));
  }, [loadedDocument, selectedId, selectedPath]);

  useEffect(
    () =>
      controller.subscribe((transaction) => {
        if (transaction.preferencesChanged && !saveManuscriptPreferences(transaction.state)) {
          setStatus("設定を保存できませんでした");
        }
      }),
    [controller],
  );

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
      if (found !== undefined) {
        const next: AppState = { version: 1, selectedPath: found.path };
        setAppState(next);
        if (!saveAppState(next)) setStatus("選択状態を保存できませんでした");
      }
      setFilesSheetOpen(false);
    },
    [files],
  );

  const onViewEvent = useCallback(
    (event: ManuscriptViewEvent) => {
      if (event.type === "visible-page.change" && selectedPath !== null) {
        savePage(selectedPath, event.page);
      }
    },
    [selectedPath],
  );

  const selectDiagnostic = (_diagnostic: ManuscriptDiagnostic) => {
    setDiagnosticsSheetOpen(false);
  };

  return (
    <div className={diagnosticDrawerOpen ? "app app--diagnostics" : "app"}>
      <a className="skip-link visually-hidden" href="#preview">
        プレビューへスキップ
      </a>
      <Sidebar files={files} selectedId={selectedId} onSelect={onSelect} status={status} />

      <main id="preview" className="preview" tabIndex={-1} aria-label="プレビュー">
        {selectedFile === null ? (
          <p className="preview__empty">監視対象の .txt ファイルがありません。</p>
        ) : (
          <>
            <ViewerToolbar
              className="desktop-viewer-toolbar"
              documentLabel={selectedFile.path}
              onDiagnosticsOpen={() => {
                setDiagnosticDrawerOpen((open) => !open);
              }}
            />
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
                aria-label={`校正エラー ${diagnosticCount}件`}
                onClick={() => {
                  setDiagnosticsSheetOpen(true);
                }}
              >
                校正 <span>{diagnosticCount}</span>
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
            ) : (
              <IframeIsolation>
                <ManuscriptViewer
                  ref={viewRef}
                  onViewEvent={onViewEvent}
                  onDiagnosticSelect={() => {
                    if (window.matchMedia("(max-width: 52rem)").matches) {
                      setDiagnosticsSheetOpen(true);
                    } else {
                      setDiagnosticDrawerOpen(true);
                    }
                  }}
                />
              </IframeIsolation>
            )}
          </>
        )}
      </main>

      {diagnosticDrawerOpen && (
        <aside className="diagnostic-drawer" aria-label="校正エラー">
          <header>
            <h2>校正エラー</h2>
            <button
              type="button"
              aria-label="校正エラーを閉じる"
              onClick={() => {
                setDiagnosticDrawerOpen(false);
              }}
            >
              閉じる
            </button>
          </header>
          <DiagnosticList onSelect={selectDiagnostic} />
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
        <ZoomControls verbose className="mobile-zoom" />
        <SettingsPanel idPrefix="mobile-" status={status} />
      </Sheet>
      <Sheet
        open={diagnosticsSheetOpen}
        title="校正エラー"
        onClose={() => {
          setDiagnosticsSheetOpen(false);
        }}
      >
        <DiagnosticList onSelect={selectDiagnostic} />
      </Sheet>
    </div>
  );
}

export function App() {
  const [controller] = useState(() => createManuscript(loadManuscriptPreferences()));

  return (
    <ManuscriptProvider controller={controller}>
      <Workspace controller={controller} />
    </ManuscriptProvider>
  );
}
