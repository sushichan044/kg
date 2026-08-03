import {
  FONT_PRESETS,
  FONT_SIZE_PT_RANGE,
  PAPER_SIZES,
  SETTING_RANGES,
  maxFontSizePt,
  validateCompositionSettings,
} from "@sushichan044/kg-core";
import type {
  FontPresetId,
  GridComposedManuscript,
  ManuscriptCompositionSettings,
  PaperSizeId,
} from "@sushichan044/kg-core";
import { adjacentZoomLevel } from "@sushichan044/kg-viewer";
import type { ZoomMode } from "@sushichan044/kg-viewer";
import { useState } from "react";

import type { ManuscriptPreset } from "../lib/storage";

interface ZoomControlsProps {
  readonly zoom: ZoomMode;
  readonly effectivePercent: number;
  readonly verbose?: boolean;
  readonly className?: string;
  readonly onChange: (zoom: ZoomMode) => void;
}

function classNames(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function ZoomControls({
  zoom,
  effectivePercent,
  verbose = false,
  className,
  onChange,
}: ZoomControlsProps) {
  const zoomOut = adjacentZoomLevel(effectivePercent, "out");
  const zoomIn = adjacentZoomLevel(effectivePercent, "in");
  return (
    <div
      className={classNames(
        "kgv-zoom-controls",
        verbose ? "kgv-zoom-controls--verbose" : undefined,
        className,
      )}
      aria-label="ズーム"
    >
      <button
        type="button"
        aria-label="縮小"
        disabled={zoomOut === null}
        onClick={() => {
          if (zoomOut !== null) onChange({ mode: "fixed", percent: zoomOut });
        }}
      >
        −
      </button>
      <output aria-label="現在のズーム">{Math.round(effectivePercent)}%</output>
      <button
        type="button"
        aria-label="拡大"
        disabled={zoomIn === null}
        onClick={() => {
          if (zoomIn !== null) onChange({ mode: "fixed", percent: zoomIn });
        }}
      >
        ＋
      </button>
      <button
        type="button"
        aria-pressed={zoom.mode === "fit"}
        onClick={() => {
          onChange({ mode: "fit" });
        }}
      >
        {verbose ? "ページに合わせる" : "全体"}
      </button>
    </div>
  );
}

interface ViewerToolbarProps extends ZoomControlsProps {
  readonly documentLabel: string;
  readonly composed: GridComposedManuscript;
  readonly diagnosticCount: number;
  readonly onDiagnosticsOpen: () => void;
}

export function ViewerToolbar({
  documentLabel,
  composed,
  diagnosticCount,
  onDiagnosticsOpen,
  ...zoomProps
}: ViewerToolbarProps) {
  return (
    <div className={classNames("kgv-toolbar-container", zoomProps.className)}>
      <div className="kgv-toolbar">
        <div className="kgv-toolbar-document">
          <strong className="kgv-toolbar-label" title={documentLabel}>
            {documentLabel}
          </strong>
          <span className="kgv-toolbar-summary">
            {composed.layout.stats.chars}字・{composed.layout.stats.pages}ページ
          </span>
        </div>
        <div className="kgv-toolbar-actions">
          <ZoomControls {...zoomProps} className={undefined} />
          <button
            type="button"
            className="kgv-diagnostics-trigger"
            aria-label={`診断 ${diagnosticCount}件`}
            onClick={onDiagnosticsOpen}
          >
            診断 <span>{diagnosticCount}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface SettingsPanelProps {
  readonly composition: ManuscriptCompositionSettings;
  readonly composed: GridComposedManuscript;
  readonly presets: readonly ManuscriptPreset[];
  readonly status: string;
  readonly idPrefix?: string;
  readonly onCompositionChange: (composition: ManuscriptCompositionSettings) => void;
  readonly onPresetApply: (preset: ManuscriptPreset) => void;
  readonly onPresetSave: (preset: ManuscriptPreset) => void;
  readonly onPresetDelete: (name: string) => void;
}

type GridKey = keyof ManuscriptCompositionSettings["grid"];
type OffsetScope = keyof ManuscriptCompositionSettings["offsets"];
type OffsetEdge = "leading" | "trailing";

function numericValue(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function SettingsPanel({
  composition,
  composed,
  presets,
  status,
  idPrefix = "",
  onCompositionChange,
  onPresetApply,
  onPresetSave,
  onPresetDelete,
}: SettingsPanelProps) {
  const [presetName, setPresetName] = useState("");

  const accept = (candidate: ManuscriptCompositionSettings) => {
    if (validateCompositionSettings(candidate).ok) onCompositionChange(candidate);
  };
  const changeGrid = (key: GridKey, value: string) => {
    const parsed = numericValue(value);
    if (parsed === null) return;
    accept({ ...composition, grid: { ...composition.grid, [key]: parsed } });
  };
  const changeOffset = (scope: OffsetScope, edge: OffsetEdge, value: string) => {
    const parsed = numericValue(value);
    if (parsed === null) return;
    accept({
      ...composition,
      offsets: {
        ...composition.offsets,
        [scope]: { ...composition.offsets[scope], [edge]: parsed },
      },
    });
  };
  const maximumFontSize = maxFontSizePt(composition.grid, composition.appearance.paperSize);

  return (
    <div className="kgv-settings-panel">
      <fieldset className="kgv-controls">
        <legend>原稿用紙</legend>
        {(
          [
            ["charsPerLine", "一行の文字数"],
            ["linesPerStage", "一段の行数"],
            ["stagesPerPage", "一頁の段数"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="kgv-control" htmlFor={`${idPrefix}${key}`}>
            <span>{label}</span>
            <input
              id={`${idPrefix}${key}`}
              type="number"
              min={SETTING_RANGES[key].min}
              max={SETTING_RANGES[key].max}
              value={composition.grid[key]}
              onChange={(event) => {
                changeGrid(key, event.currentTarget.value);
              }}
            />
          </label>
        ))}
      </fieldset>

      <fieldset className="kgv-paper-controls">
        <legend>用紙と書体</legend>
        <label className="kgv-select-control">
          <span>用紙</span>
          <select
            value={composition.appearance.paperSize}
            onChange={(event) => {
              accept({
                ...composition,
                appearance: {
                  ...composition.appearance,
                  paperSize: event.currentTarget.value as PaperSizeId,
                },
              });
            }}
          >
            {Object.values(PAPER_SIZES).map((paper) => (
              <option key={paper.id} value={paper.id}>
                {paper.label}
              </option>
            ))}
          </select>
        </label>
        <label className="kgv-control">
          <span>文字サイズ</span>
          <input
            type="number"
            min={FONT_SIZE_PT_RANGE.min}
            max={FONT_SIZE_PT_RANGE.max}
            step={FONT_SIZE_PT_RANGE.step}
            value={composition.appearance.fontSizePt}
            onChange={(event) => {
              const fontSizePt = numericValue(event.currentTarget.value);
              if (fontSizePt !== null) {
                accept({ ...composition, appearance: { ...composition.appearance, fontSizePt } });
              }
            }}
          />
          <small className="kgv-control-hint">pt（推奨上限 {maximumFontSize}）</small>
        </label>
        <label className="kgv-select-control">
          <span>書体</span>
          <select
            value={composition.appearance.fontPreset}
            onChange={(event) => {
              accept({
                ...composition,
                appearance: {
                  ...composition.appearance,
                  fontPreset: event.currentTarget.value as FontPresetId,
                },
              });
            }}
          >
            {Object.values(FONT_PRESETS).map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>
        </label>
        {!composed.layout.geometry.fitsPaper && (
          <p className="kgv-paper-warning">この設定では原稿用紙が用紙に収まりません。</p>
        )}
      </fieldset>

      <fieldset className="kgv-offset-controls">
        <legend>空き行</legend>
        {(
          [
            ["document", "原稿"],
            ["page", "ページ"],
            ["stage", "段"],
          ] as const
        ).flatMap(([scope, scopeLabel]) =>
          (["leading", "trailing"] as const).map((edge) => (
            <label key={`${scope}-${edge}`} className="kgv-control">
              <span>
                {scopeLabel}
                {edge === "leading" ? "先頭" : "末尾"}
              </span>
              <input
                type="number"
                min={0}
                value={composition.offsets[scope][edge]}
                onChange={(event) => {
                  changeOffset(scope, edge, event.currentTarget.value);
                }}
              />
            </label>
          )),
        )}
      </fieldset>

      <section className="kgv-presets" aria-labelledby={`${idPrefix}presets-heading`}>
        <strong id={`${idPrefix}presets-heading`}>プリセット</strong>
        <div className="kgv-preset-save">
          <input
            aria-label="プリセット名"
            value={presetName}
            onChange={(event) => {
              setPresetName(event.currentTarget.value);
            }}
          />
          <button
            type="button"
            disabled={presetName.trim() === ""}
            onClick={() => {
              const name = presetName.trim();
              if (name === "") return;
              onPresetSave({ name, composition });
              setPresetName("");
            }}
          >
            保存
          </button>
        </div>
        <ul className="kgv-preset-list">
          {presets.map((preset) => (
            <li key={preset.name}>
              <button
                type="button"
                onClick={() => {
                  onPresetApply(preset);
                }}
              >
                {preset.name}
              </button>
              <button
                type="button"
                aria-label={`${preset.name}を削除`}
                onClick={() => {
                  onPresetDelete(preset.name);
                }}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      </section>

      <dl className="kgv-stats">
        <div>
          <dt>文字数</dt>
          <dd>{composed.layout.stats.chars}</dd>
        </div>
        <div>
          <dt>ページ数</dt>
          <dd>{composed.layout.stats.pages}</dd>
        </div>
      </dl>
      <p className="kgv-status" role="status">
        {status}
      </p>
    </div>
  );
}
