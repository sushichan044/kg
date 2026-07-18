import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ManuscriptGrid } from "./components/ManuscriptGrid";
import { Sidebar } from "./components/Sidebar";
import { useServerEvents } from "./hooks/useServerEvents";
import { fetchContent, fetchFiles } from "./lib/api";
import type { FileEntry } from "./lib/api";
import { DEFAULT_SETTINGS, paginate, SETTING_RANGES } from "./lib/pagination";
import type { GridSettings } from "./lib/pagination";
import { loadPage, loadState, savePage, saveState } from "./lib/storage";
import type { ViewerState } from "./lib/storage";

type SettingField = keyof GridSettings;

const EMPTY_STATS = { chars: 0, sourceLines: 0, pages: 0 };
const NO_INVALID: Record<SettingField, boolean> = {
  charsPerLine: false,
  linesPerStage: false,
  stagesPerPage: false,
};

const BUILTIN_PRESET_NAME = `${DEFAULT_SETTINGS.charsPerLine}字 × ${DEFAULT_SETTINGS.linesPerStage}行 × ${DEFAULT_SETTINGS.stagesPerPage}段`;

function initialDrafts(settings: GridSettings): Record<SettingField, string> {
  return {
    charsPerLine: String(settings.charsPerLine),
    linesPerStage: String(settings.linesPerStage),
    stagesPerPage: String(settings.stagesPerPage),
  };
}

export function App() {
  const [state, setState] = useState<ViewerState>(loadState);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [content, setContent] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [drafts, setDrafts] = useState(() => initialDrafts(state.settings));
  const [invalid, setInvalid] = useState<Record<SettingField, boolean>>(NO_INVALID);

  // Latest state for event handlers that must not close over stale values.
  const stateRef = useRef(state);
  stateRef.current = state;

  const { settings } = state;

  const selectedFile = files.find((f) => f.path === state.selectedPath) ?? files[0] ?? null;
  const selectedId = selectedFile?.id ?? null;
  const selectedPath = selectedFile?.path ?? null;

  const refreshFiles = useCallback(async () => {
    try {
      setFiles(await fetchFiles());
    } catch {
      setStatus("ファイル一覧の取得に失敗しました");
    }
  }, []);

  const loadContent = useCallback(async (id: string) => {
    try {
      setContent(await fetchContent(id));
    } catch {
      setStatus("本文の取得に失敗しました");
    }
  }, []);

  useEffect(() => {
    void refreshFiles();
  }, [refreshFiles]);

  // Keep the persisted selection in sync with the resolved selection.
  useEffect(() => {
    if (selectedFile && selectedFile.path !== state.selectedPath) {
      setState((s) => ({ ...s, selectedPath: selectedFile.path }));
    }
  }, [selectedFile, state.selectedPath]);

  // Restore the remembered page when the selected file changes.
  useEffect(() => {
    setCurrentPage(selectedPath === null ? 0 : loadPage(selectedPath));
  }, [selectedPath]);

  // Refetch content whenever the selected file changes.
  useEffect(() => {
    if (selectedId === null) {
      setContent(null);

      return;
    }
    void loadContent(selectedId);
  }, [selectedId, loadContent]);

  // Persist settings, selection, and presets; surface storage failures.
  useEffect(() => {
    if (!saveState(state)) {
      setStatus("設定を保存できませんでした");
    }
  }, [state]);

  useServerEvents({
    onCatalogChanged: () => {
      void refreshFiles();
      setStatus("ファイル一覧を更新しました");
    },
    onFileChanged: (id) => {
      if (id === selectedId) {
        void loadContent(id);
      }
    },
  });

  const onSettingChange = useCallback((field: SettingField, raw: string) => {
    setDrafts((d) => ({ ...d, [field]: raw }));

    const n = Number(raw);
    const range = SETTING_RANGES[field];
    const valid = raw.trim() !== "" && Number.isInteger(n) && n >= range.min && n <= range.max;

    setInvalid((v) => ({ ...v, [field]: !valid }));
    if (valid) {
      setState((s) => ({ ...s, settings: { ...s.settings, [field]: n } }));
    }
  }, []);

  const onSelect = useCallback((id: string) => {
    setFiles((current) => {
      const found = current.find((f) => f.id === id);
      if (found) {
        setState((s) => ({ ...s, selectedPath: found.path }));
      }

      return current;
    });
  }, []);

  const onVisiblePageChange = useCallback((index: number) => {
    setCurrentPage(index);
    const path = stateRef.current.selectedPath;
    if (path !== null) {
      savePage(path, index);
    }
  }, []);

  const applyPreset = useCallback((name: string) => {
    const preset =
      name === BUILTIN_PRESET_NAME
        ? { name, settings: DEFAULT_SETTINGS }
        : stateRef.current.presets.find((p) => p.name === name);
    if (preset === undefined) {
      return;
    }
    setState((s) => ({ ...s, settings: preset.settings }));
    setDrafts(initialDrafts(preset.settings));
    setInvalid(NO_INVALID);
    setStatus(`プリセット「${name}」を適用しました`);
  }, []);

  const savePreset = useCallback((rawName: string) => {
    const name = rawName.trim();
    if (name === "") {
      return;
    }
    if (name === BUILTIN_PRESET_NAME) {
      setStatus("組み込みプリセットは上書きできません");

      return;
    }
    const exists = stateRef.current.presets.some((p) => p.name === name);
    if (exists && !window.confirm(`プリセット「${name}」を上書きしますか？`)) {
      return;
    }
    setState((s) => ({
      ...s,
      presets: [...s.presets.filter((p) => p.name !== name), { name, settings: s.settings }],
    }));
    setStatus(`プリセット「${name}」を保存しました`);
  }, []);

  const deletePreset = useCallback((name: string) => {
    if (!window.confirm(`プリセット「${name}」を削除しますか？`)) {
      return;
    }
    setState((s) => ({ ...s, presets: s.presets.filter((p) => p.name !== name) }));
    setStatus(`プリセット「${name}」を削除しました`);
  }, []);

  const pagination = useMemo(
    () => (content === null ? null : paginate(content, settings)),
    [content, settings],
  );

  const headerSettings = `${settings.charsPerLine}字 × ${settings.linesPerStage}行 × ${settings.stagesPerPage}段`;

  return (
    <div className="app">
      <a className="skip-link visually-hidden" href="#preview">
        プレビューへスキップ
      </a>

      <Sidebar
        files={files}
        selectedId={selectedId}
        onSelect={onSelect}
        drafts={drafts}
        invalid={invalid}
        onSettingChange={onSettingChange}
        presets={state.presets}
        builtinPresetName={BUILTIN_PRESET_NAME}
        onApplyPreset={applyPreset}
        onSavePreset={savePreset}
        onDeletePreset={deletePreset}
        stats={pagination?.stats ?? EMPTY_STATS}
        status={status}
      />

      <main id="preview" className="preview" tabIndex={-1} aria-label="プレビュー">
        {selectedFile === null ? (
          <p className="preview__empty">監視対象の .txt ファイルがありません。</p>
        ) : (
          <>
            <header className="preview__header">
              <span className="preview__path">{selectedFile.path}</span>
              <span className="preview__settings">{headerSettings}</span>
            </header>
            {pagination === null ? (
              <p className="preview__loading">読み込み中…</p>
            ) : (
              <ManuscriptGrid
                pages={pagination.pages}
                restoreToPage={currentPage}
                onVisiblePageChange={onVisiblePageChange}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
