import { useEffect, useReducer, useState } from "react";

import { DocumentRegion } from "./components/DocumentRegion";
import type { DocumentRegionProps } from "./components/DocumentRegion";
import { DocumentSession } from "./components/DocumentSession";
import { Sheet } from "./components/Sheet";
import type { MobileSheet } from "./components/Sheet";
import { FilePanel, Sidebar } from "./components/Sidebar";
import { SettingsPanel, ZoomControls } from "./components/ViewerControls";
import { useFileCatalog } from "./hooks/useDocuments";
import { useServerEvents } from "./hooks/useServerEvents";
import type { FileEntry } from "./lib/api";
import {
  loadAppState,
  loadManuscriptPreferences,
  saveAppState,
  saveManuscriptPreferences,
} from "./lib/storage";
import type { ManuscriptPreferences } from "./lib/storage";
import { preferencesReducer } from "./manuscript";

const FILE_QUERY_PARAM = "file";

function loadInitialSelectedPath(): string | null {
  const stored = loadAppState();
  const selectedPath = new URL(window.location.href).searchParams.get(FILE_QUERY_PARAM);
  return selectedPath === null || selectedPath === "" ? stored.selectedPath : selectedPath;
}

function replaceSelectedPathInURL(path: string | null): void {
  const url = new URL(window.location.href);
  if (path === null) url.searchParams.delete(FILE_QUERY_PARAM);
  else url.searchParams.set(FILE_QUERY_PARAM, path);
  window.history.replaceState(window.history.state, "", url);
}

type WorkspaceProps = Omit<DocumentRegionProps, "preview" | "refreshContent"> &
  Readonly<{
    files: readonly FileEntry[];
    status: string;
    catalogFailed: boolean;
    onSelect: (id: string) => void;
    refreshFiles: () => void;
    revision: number;
    summaryTarget: HTMLDivElement | null;
    setSummaryTarget: (target: HTMLDivElement | null) => void;
  }>;

export function App() {
  const [preferences, dispatch] = useReducer(
    preferencesReducer,
    undefined,
    loadManuscriptPreferences,
  );
  const [storageStatus, setStorageStatus] = useState("");
  const [sheet, setSheet] = useState<MobileSheet>(null);
  const [diagnosticDrawerOpen, setDiagnosticDrawerOpen] = useState(false);
  const [fitZoom, setFitZoom] = useState(preferences.zoom);
  const [revision, setRevision] = useState(0);
  const [summaryTarget, setSummaryTarget] = useState<HTMLDivElement | null>(null);
  const { catalog, refresh: refreshFiles, select } = useFileCatalog(loadInitialSelectedPath);
  const files = catalog.kind === "ready" ? catalog.files : [];
  const selectedFile = files.find((file) => file.path === catalog.selectedPath) ?? files[0] ?? null;
  const selectedId = selectedFile?.id ?? null;
  const selectedPath = selectedFile?.path ?? null;
  const catalogFailed =
    catalog.kind === "failed" || (catalog.kind === "ready" && catalog.refreshFailed);

  /* oxlint-disable react/set-state-in-effect -- Report failed external writes while the reducer owns preferences. */
  useEffect(() => {
    if (!saveManuscriptPreferences(preferences)) setStorageStatus("設定を保存できませんでした");
  }, [preferences]);

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
      if (id === selectedId) setRevision((value) => value + 1);
    },
  });

  const props: WorkspaceProps = {
    files,
    selectedFile,
    preferences,
    dispatch,
    catalogFailed,
    status: catalogFailed ? "ファイル一覧の取得に失敗しました" : storageStatus,
    onSelect: (id) => {
      const file = files.find((entry) => entry.id === id);
      if (file !== undefined) select(file.path);
      setSheet(null);
    },
    sheet,
    setSheet,
    diagnosticDrawerOpen,
    setDiagnosticDrawerOpen,
    fitZoom,
    setFitZoom,
    revision,
    summaryTarget,
    setSummaryTarget,
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
    setSummaryTarget,
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

      {selectedFile === null ? (
        <DocumentRegion {...props} refreshContent={() => {}} preview={{ kind: "loading" }} />
      ) : (
        <DocumentSession key={selectedFile.id} {...props} selectedFile={selectedFile} />
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
        <div ref={setSummaryTarget} />
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
