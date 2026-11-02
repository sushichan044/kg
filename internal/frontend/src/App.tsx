import { useTypography } from "@sushichan044/kg-viewer";
import { Suspense, useEffect, useReducer, useState } from "react";

import { DocumentRegion, DocumentSummary, LoadedDocumentRegion } from "./components/DocumentRegion";
import type { DocumentRegionProps } from "./components/DocumentRegion";
import { Sheet } from "./components/Sheet";
import type { MobileSheet } from "./components/Sheet";
import { FilePanel, Sidebar } from "./components/Sidebar";
import { SettingsPanel, ZoomControls } from "./components/ViewerControls";
import { useDocumentRequest, useFileCatalog } from "./hooks/useDocuments";
import { useManuscriptPreview } from "./hooks/useManuscriptPreview";
import type { PreviewResource } from "./hooks/useManuscriptPreview";
import { useServerEvents } from "./hooks/useServerEvents";
import type { FileEntry } from "./lib/api";
import {
  loadAppState,
  loadManuscriptPreferences,
  saveAppState,
  saveManuscriptPreferences,
} from "./lib/storage";
import type { AppState, ManuscriptPreferences } from "./lib/storage";
import { manuscriptReducer } from "./manuscript";

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

type WorkspaceProps = DocumentRegionProps &
  Readonly<{
    files: readonly FileEntry[];
    status: string;
    catalogFailed: boolean;
    onSelect: (id: string) => void;
    refreshFiles: () => void;
    previewResource: PreviewResource | null;
  }>;

export function App() {
  const [manuscript, dispatch] = useReducer(manuscriptReducer, undefined, () => ({
    preferences: loadManuscriptPreferences(),
  }));
  const [appState, setAppState] = useState(loadInitialAppState);
  const [storageStatus, setStorageStatus] = useState("");
  const [sheet, setSheet] = useState<MobileSheet>(null);
  const [diagnosticDrawerOpen, setDiagnosticDrawerOpen] = useState(false);
  const [fitZoom, setFitZoom] = useState(manuscript.preferences.zoom);
  const { catalog, refresh: refreshFiles } = useFileCatalog();
  const files = catalog.kind === "ready" ? catalog.files : [];
  const selectedFile =
    files.find((file) => file.path === appState.selectedPath) ?? files[0] ?? null;
  const selectedId = selectedFile?.id ?? null;
  const selectedPath = selectedFile?.path ?? null;
  const { request, refresh: refreshContent } = useDocumentRequest(selectedId);
  const catalogFailed =
    catalog.kind === "failed" || (catalog.kind === "ready" && catalog.refreshFailed);

  if (catalog.kind === "ready" && appState.selectedPath !== selectedPath)
    setAppState({ version: 1, selectedPath });

  /* oxlint-disable react/set-state-in-effect -- Report failed external writes while the reducer owns preferences. */
  useEffect(() => {
    if (!saveManuscriptPreferences(manuscript.preferences))
      setStorageStatus("設定を保存できませんでした");
  }, [manuscript.preferences]);

  useEffect(() => {
    if (catalog.kind !== "ready") return;
    replaceSelectedPathInURL(selectedPath);
    if (!saveAppState({ version: 1, selectedPath }))
      setStorageStatus("選択状態を保存できませんでした");
  }, [catalog.kind, selectedPath]);
  /* oxlint-enable react/set-state-in-effect */

  useServerEvents({
    onCatalogChanged: () => {
      void refreshFiles();
    },
    onFileChanged: (id) => {
      if (id === selectedId) refreshContent();
    },
  });

  const typographyState = useTypography(manuscript.preferences.composition.appearance.fontPreset);
  const { previewResource, preview } = useManuscriptPreview(
    request,
    manuscript.preferences,
    typographyState,
  );

  const props: WorkspaceProps = {
    files,
    selectedFile,
    preferences: manuscript.preferences,
    dispatch,
    catalogFailed,
    status: catalogFailed ? "ファイル一覧の取得に失敗しました" : storageStatus,
    onSelect: (id) => {
      const file = files.find((entry) => entry.id === id);
      if (file !== undefined) setAppState({ version: 1, selectedPath: file.path });
      setSheet(null);
    },
    sheet,
    setSheet,
    diagnosticDrawerOpen,
    setDiagnosticDrawerOpen,
    fitZoom,
    setFitZoom,
    refreshContent,
    preview,
    previewResource,
    refreshFiles: () => {
      void refreshFiles();
    },
  };

  return <Workspace {...props} />;
}

function Workspace(props: WorkspaceProps) {
  const {
    files,
    selectedFile,
    preferences,
    dispatch,
    status,
    onSelect,
    sheet,
    setSheet,
    diagnosticDrawerOpen,
    fitZoom,
    refreshFiles,
    catalogFailed,
    previewResource,
  } = props;
  const selectedId = selectedFile?.id ?? null;
  const zoom = preferences.fit ? fitZoom : preferences.zoom;
  const changeZoom = (value: number) => {
    dispatch({ kind: "zoom.replace", zoom: value, fit: false });
  };
  const enableFit = () => {
    dispatch({ kind: "zoom.replace", zoom: preferences.zoom, fit: true });
  };
  const settingsProps = {
    notation: preferences.notation,
    composition: preferences.composition,
    showGrid: preferences.showGrid,
    presets: preferences.presets,
    status,
    onNotationChange: (notation: ManuscriptPreferences["notation"]) => {
      dispatch({ kind: "notation.replace", notation });
    },
    onCompositionChange: (composition: ManuscriptPreferences["composition"]) => {
      dispatch({ kind: "composition.replace", composition });
    },
    onGridChange: (showGrid: boolean) => {
      dispatch({ kind: "grid-visibility.replace", showGrid });
    },
    onPresetApply: (preset: ManuscriptPreferences["presets"][number]) => {
      dispatch({ kind: "preset.apply", preset });
    },
    onPresetSave: (preset: ManuscriptPreferences["presets"][number]) => {
      dispatch({ kind: "preset.save", preset });
    },
    onPresetDelete: (name: string) => {
      dispatch({ kind: "preset.delete", name });
    },
  };

  return (
    <div className={diagnosticDrawerOpen ? "app app--diagnostics" : "app"}>
      <a className="skip-link visually-hidden" href="#preview">
        プレビューへスキップ
      </a>
      <Sidebar files={files} selectedId={selectedId} onSelect={onSelect} status={status}>
        <SettingsPanel {...settingsProps} idPrefix="desktop-" />
        {catalogFailed && (
          <button type="button" onClick={refreshFiles}>
            ファイル一覧を再取得
          </button>
        )}
      </Sidebar>

      {previewResource === null ? (
        <DocumentRegion {...props} />
      ) : (
        <Suspense
          key={selectedId}
          fallback={<DocumentRegion {...props} preview={{ kind: "loading" }} />}
        >
          <LoadedDocumentRegion {...props} resource={previewResource} />
        </Suspense>
      )}
      <Sheet
        open={sheet === "files"}
        title="ファイル"
        onClose={() => {
          setSheet(null);
        }}
      >
        <FilePanel files={files} selectedId={selectedId} onSelect={onSelect} />
      </Sheet>
      <Sheet
        open={sheet === "settings"}
        title="表示設定"
        onClose={() => {
          setSheet(null);
        }}
      >
        {previewResource !== null && (
          <Suspense fallback={null}>
            <DocumentSummary resource={previewResource} />
          </Suspense>
        )}
        <ZoomControls
          className="mobile-zoom"
          zoom={zoom}
          fit={preferences.fit}
          onZoomChange={changeZoom}
          onFitChange={enableFit}
        />
        <SettingsPanel {...settingsProps} />
      </Sheet>
    </div>
  );
}
