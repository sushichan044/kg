import {
  adjacentZoomLevel,
  calculateManuscriptGeometry,
  DEFAULT_APPEARANCE,
  DEFAULT_SETTINGS,
  fontPreset,
  paginateManuscript,
  paperSize,
  proofreadManuscript,
  SETTING_RANGES,
} from "@sushichan044/kg-core";
import type {
  FixedZoomPercent,
  FontPresetId,
  GridSettings,
  ManuscriptDiagnostic,
  MarginMm,
  PaperSizeId,
  ZoomMode,
} from "@sushichan044/kg-core";
import { DiagnosticList, ManuscriptViewer, ViewerToolbar } from "@sushichan044/kg-viewer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";

import { FilePanel, SettingsPanel, Sidebar } from "./components/Sidebar";
import { useServerEvents } from "./hooks/useServerEvents";
import { fetchContent, fetchFiles } from "./lib/api";
import type { FileEntry } from "./lib/api";
import { loadPage, loadState, savePage, saveState } from "./lib/storage";
import type { ViewerState } from "./lib/storage";

type SettingField = keyof GridSettings;

const EMPTY_STATS = { chars: 0, sourceLines: 0, pages: 0 };
const NO_INVALID: Record<SettingField, boolean> = {
  charsPerLine: false,
  linesPerStage: false,
  stagesPerPage: false,
};

const BUILTIN_PRESET_NAME = `${paperSize(DEFAULT_APPEARANCE.paperSize).label} / ${DEFAULT_APPEARANCE.marginMm}mm / ${fontPreset(DEFAULT_APPEARANCE.fontPreset).label} / ${DEFAULT_SETTINGS.charsPerLine}字 × ${DEFAULT_SETTINGS.linesPerStage}行 × ${DEFAULT_SETTINGS.stagesPerPage}段`;

interface LoadedContent {
  id: string;
  text: string;
}

function initialDrafts(settings: GridSettings): Record<SettingField, string> {
  return {
    charsPerLine: String(settings.charsPerLine),
    linesPerStage: String(settings.linesPerStage),
    stagesPerPage: String(settings.stagesPerPage),
  };
}

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
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const dismissBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) {
      event.currentTarget.close();
    }
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

interface MobileZoomControlsProps {
  zoom: ZoomMode;
  effectivePercent: number;
  onChange: (zoom: ZoomMode) => void;
}

function MobileZoomControls({ zoom, effectivePercent, onChange }: MobileZoomControlsProps) {
  const zoomOut = adjacentZoomLevel(effectivePercent, "out");
  const zoomIn = adjacentZoomLevel(effectivePercent, "in");
  const applyFixed = (percent: FixedZoomPercent | null) => {
    if (percent !== null) {
      onChange({ mode: "fixed", percent });
    }
  };

  return (
    <fieldset className="mobile-zoom">
      <legend>表示倍率</legend>
      <div role="group" aria-label="表示倍率">
        <button
          type="button"
          disabled={zoomOut === null}
          onClick={() => {
            applyFixed(zoomOut);
          }}
        >
          縮小
        </button>
        <output>{Math.round(effectivePercent)}%</output>
        <button
          type="button"
          disabled={zoomIn === null}
          onClick={() => {
            applyFixed(zoomIn);
          }}
        >
          拡大
        </button>
        <button
          type="button"
          aria-pressed={zoom.mode === "fit"}
          onClick={() => {
            onChange({ mode: "fit" });
          }}
        >
          全体表示
        </button>
      </div>
    </fieldset>
  );
}

export function App() {
  const [state, setState] = useState<ViewerState>(loadState);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loadedContent, setLoadedContent] = useState<LoadedContent | null>(null);
  const [status, setStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [drafts, setDrafts] = useState(() => initialDrafts(state.settings));
  const [invalid, setInvalid] = useState<Record<SettingField, boolean>>(NO_INVALID);
  const [effectiveZoomPercent, setEffectiveZoomPercent] = useState<number>(
    state.zoom.mode === "fixed" ? state.zoom.percent : 100,
  );
  const [activeDiagnosticId, setActiveDiagnosticId] = useState<string | null>(null);
  const [diagnosticDrawerOpen, setDiagnosticDrawerOpen] = useState(false);
  const [filesSheetOpen, setFilesSheetOpen] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [diagnosticsSheetOpen, setDiagnosticsSheetOpen] = useState(false);

  const { appearance, settings, zoom } = state;
  const selectedFile = files.find((file) => file.path === state.selectedPath) ?? files[0] ?? null;
  const selectedId = selectedFile?.id ?? null;
  const selectedPath = selectedFile?.path ?? null;
  const content =
    selectedId !== null && loadedContent?.id === selectedId ? loadedContent.text : null;
  const [previousSelectedPath, setPreviousSelectedPath] = useState<string | null>(selectedPath);
  if (selectedPath !== previousSelectedPath) {
    setPreviousSelectedPath(selectedPath);
    setCurrentPage(selectedPath === null ? 0 : loadPage(selectedPath));
    setActiveDiagnosticId(null);
  }

  const refreshFiles = useCallback(async () => {
    try {
      const nextFiles = await fetchFiles();
      setFiles(nextFiles);
      setState((current) => {
        const selected =
          nextFiles.find((file) => file.path === current.selectedPath) ?? nextFiles[0] ?? null;

        return selected === null || selected.path === current.selectedPath
          ? current
          : { ...current, selectedPath: selected.path };
      });
    } catch {
      setStatus("ファイル一覧の取得に失敗しました");
    }
  }, []);

  const loadContent = useCallback(async (id: string) => {
    try {
      setLoadedContent({ id, text: await fetchContent(id) });
    } catch {
      setStatus("本文の取得に失敗しました");
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    void fetchFiles().then(
      (nextFiles) => {
        if (ignore) {
          return;
        }
        setFiles(nextFiles);
        setState((current) => {
          const selected =
            nextFiles.find((file) => file.path === current.selectedPath) ?? nextFiles[0] ?? null;

          return selected === null || selected.path === current.selectedPath
            ? current
            : { ...current, selectedPath: selected.path };
        });
      },
      () => {
        if (!ignore) {
          setStatus("ファイル一覧の取得に失敗しました");
        }
      },
    );

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (selectedId === null) {
      return;
    }
    let ignore = false;
    void fetchContent(selectedId).then(
      (text) => {
        if (!ignore) {
          setLoadedContent({ id: selectedId, text });
        }
      },
      () => {
        if (!ignore) {
          setStatus("本文の取得に失敗しました");
        }
      },
    );

    return () => {
      ignore = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (saveState(state)) {
      return;
    }
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setStatus("設定を保存できませんでした");
      }
    });

    return () => {
      active = false;
    };
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
    setDrafts((current) => ({ ...current, [field]: raw }));
    const value = Number(raw);
    const range = SETTING_RANGES[field];
    const valid =
      raw.trim() !== "" && Number.isInteger(value) && value >= range.min && value <= range.max;
    setInvalid((current) => ({ ...current, [field]: !valid }));
    if (valid) {
      setState((current) => ({
        ...current,
        settings: { ...current.settings, [field]: value },
      }));
    }
  }, []);

  const onSelect = useCallback(
    (id: string) => {
      const found = files.find((file) => file.id === id);
      if (found !== undefined) {
        setState((viewer) => ({ ...viewer, selectedPath: found.path }));
      }
      setFilesSheetOpen(false);
    },
    [files],
  );

  const onVisiblePageChange = useCallback(
    (index: number) => {
      setCurrentPage(index);
      if (selectedPath !== null) {
        savePage(selectedPath, index);
      }
    },
    [selectedPath],
  );

  const applyPreset = useCallback(
    (name: string) => {
      const preset =
        name === BUILTIN_PRESET_NAME
          ? { name, settings: DEFAULT_SETTINGS, appearance: DEFAULT_APPEARANCE }
          : state.presets.find((candidate) => candidate.name === name);
      if (preset === undefined) {
        return;
      }
      setState((current) => ({
        ...current,
        settings: preset.settings,
        appearance: preset.appearance,
      }));
      setDrafts(initialDrafts(preset.settings));
      setInvalid(NO_INVALID);
      setStatus(`プリセット「${name}」を適用しました`);
    },
    [state.presets],
  );

  const savePreset = useCallback(
    (rawName: string) => {
      const name = rawName.trim();
      if (name === "") {
        return;
      }
      if (name === BUILTIN_PRESET_NAME) {
        setStatus("組み込みプリセットは上書きできません");

        return;
      }
      const exists = state.presets.some((preset) => preset.name === name);
      if (exists && !window.confirm(`プリセット「${name}」を上書きしますか？`)) {
        return;
      }
      setState((current) => ({
        ...current,
        presets: [
          ...current.presets.filter((preset) => preset.name !== name),
          { name, settings: current.settings, appearance: current.appearance },
        ],
      }));
      setStatus(`プリセット「${name}」を保存しました`);
    },
    [state.presets],
  );

  const deletePreset = useCallback((name: string) => {
    if (!window.confirm(`プリセット「${name}」を削除しますか？`)) {
      return;
    }
    setState((current) => ({
      ...current,
      presets: current.presets.filter((preset) => preset.name !== name),
    }));
    setStatus(`プリセット「${name}」を削除しました`);
  }, []);

  const pagination = useMemo(
    () => (content === null ? null : paginateManuscript(content, settings)),
    [content, settings],
  );
  const diagnostics = useMemo(
    () => (content === null ? [] : proofreadManuscript(content)),
    [content],
  );
  const geometry = useMemo(
    () => calculateManuscriptGeometry(settings, appearance),
    [appearance, settings],
  );
  const selectedPaper = paperSize(appearance.paperSize);
  const selectedFont = fontPreset(appearance.fontPreset);
  const summary = `${selectedPaper.label} / ${appearance.marginMm}mm / ${selectedFont.label} / 約${geometry.fontSizePt.toFixed(1)}pt / ${settings.charsPerLine}字 × ${settings.linesPerStage}行 × ${settings.stagesPerPage}段`;

  const settingsPanelProps = {
    drafts,
    invalid,
    onSettingChange,
    appearance,
    onPaperSizeChange: (paperSizeId: PaperSizeId) => {
      setState((current) => ({
        ...current,
        appearance: { ...current.appearance, paperSize: paperSizeId },
      }));
    },
    onMarginChange: (marginMm: MarginMm) => {
      setState((current) => ({
        ...current,
        appearance: { ...current.appearance, marginMm },
      }));
    },
    onFontPresetChange: (fontPresetId: FontPresetId) => {
      setState((current) => ({
        ...current,
        appearance: { ...current.appearance, fontPreset: fontPresetId },
      }));
    },
    presets: state.presets,
    builtinPresetName: BUILTIN_PRESET_NAME,
    onApplyPreset: applyPreset,
    onSavePreset: savePreset,
    onDeletePreset: deletePreset,
    stats: pagination?.stats ?? EMPTY_STATS,
    status,
  };

  const selectDiagnostic = (diagnostic: ManuscriptDiagnostic) => {
    setActiveDiagnosticId(diagnostic.id);
    setDiagnosticsSheetOpen(false);
  };

  return (
    <div className={diagnosticDrawerOpen ? "app app--diagnostics" : "app"}>
      <a className="skip-link visually-hidden" href="#preview">
        プレビューへスキップ
      </a>
      <Sidebar files={files} selectedId={selectedId} onSelect={onSelect} {...settingsPanelProps} />

      <main id="preview" className="preview" tabIndex={-1} aria-label="プレビュー">
        {selectedFile === null ? (
          <p className="preview__empty">監視対象の .txt ファイルがありません。</p>
        ) : (
          <>
            <ViewerToolbar
              className="desktop-viewer-toolbar"
              documentLabel={selectedFile.path}
              documentSummary={summary}
              zoom={zoom}
              effectiveZoomPercent={effectiveZoomPercent}
              diagnosticCount={diagnostics.length}
              onZoomChange={(nextZoom) => {
                setState((current) => ({ ...current, zoom: nextZoom }));
              }}
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
                aria-label={`校正エラー ${diagnostics.length}件`}
                onClick={() => {
                  setDiagnosticsSheetOpen(true);
                }}
              >
                校正 <span>{diagnostics.length}</span>
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
            {content === null ? (
              <p className="preview__loading">読み込み中…</p>
            ) : (
              <ManuscriptViewer
                text={content}
                settings={settings}
                appearance={appearance}
                zoom={zoom}
                diagnostics={diagnostics}
                activeDiagnosticId={activeDiagnosticId}
                restoreToPage={currentPage}
                onVisiblePageChange={onVisiblePageChange}
                onEffectiveZoomChange={setEffectiveZoomPercent}
                onDiagnosticSelect={(diagnostic) => {
                  setActiveDiagnosticId(diagnostic.id);
                  if (window.matchMedia("(max-width: 52rem)").matches) {
                    setDiagnosticsSheetOpen(true);
                  } else {
                    setDiagnosticDrawerOpen(true);
                  }
                }}
              />
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
        <MobileZoomControls
          zoom={zoom}
          effectivePercent={effectiveZoomPercent}
          onChange={(nextZoom) => {
            setState((current) => ({ ...current, zoom: nextZoom }));
          }}
        />
        <SettingsPanel {...settingsPanelProps} idPrefix="mobile-" />
      </Sheet>
      <Sheet
        open={diagnosticsSheetOpen}
        title="校正エラー"
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
