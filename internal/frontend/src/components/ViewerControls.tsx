import {
  FontPreset,
  FontPresetId,
  FontSizePt,
  GridSettings,
  ManuscriptCompositionSettings,
  ManuscriptGeometry,
  PaperSize,
  PaperSizeId,
} from "@sushichan044/kg-core";
import type { GridComposedManuscript } from "@sushichan044/kg-core";
import { useState } from "react";

import type { ManuscriptNotation, ManuscriptPreset } from "../lib/storage";

type ZoomControlsProps = Readonly<{
  zoom: number;
  fit: boolean;
  verbose?: boolean;
  className?: string;
  onZoomChange: (zoom: number) => void;
  onFitChange: (fit: boolean) => void;
}>;

const ZOOM = { min: 50, max: 150, step: 25 } as const;

function classNames(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function ZoomControls({
  zoom,
  fit,
  verbose = false,
  className,
  onZoomChange,
  onFitChange,
}: ZoomControlsProps) {
  const zoomOut = zoom > ZOOM.min ? Math.max(ZOOM.min, zoom - ZOOM.step) : null;
  const zoomIn = zoom < ZOOM.max ? Math.min(ZOOM.max, zoom + ZOOM.step) : null;
  return (
    <div
      className={classNames(
        "zoom-controls",
        verbose ? "zoom-controls--verbose" : undefined,
        className,
      )}
      aria-label="ズーム"
    >
      <button
        type="button"
        aria-label="縮小"
        disabled={zoomOut === null}
        onClick={() => {
          if (zoomOut !== null) onZoomChange(zoomOut);
        }}
      >
        −
      </button>
      <output aria-label="現在のズーム">{Math.round(zoom)}%</output>
      <button
        type="button"
        aria-label="拡大"
        disabled={zoomIn === null}
        onClick={() => {
          if (zoomIn !== null) onZoomChange(zoomIn);
        }}
      >
        ＋
      </button>
      <button
        type="button"
        aria-pressed={fit}
        onClick={() => {
          onFitChange(true);
        }}
      >
        {verbose ? "ページに合わせる" : "全体"}
      </button>
    </div>
  );
}

type ViewerToolbarProps = ZoomControlsProps &
  Readonly<{
    documentLabel: string;
    composed: GridComposedManuscript;
    diagnosticCount: number;
    onDiagnosticsOpen: () => void;
  }>;

export function ViewerToolbar({
  documentLabel,
  composed,
  diagnosticCount,
  onDiagnosticsOpen,
  ...zoomProps
}: ViewerToolbarProps) {
  return (
    <div className={classNames("toolbar-container", zoomProps.className)}>
      <div className="toolbar">
        <div className="toolbar-document">
          <strong className="toolbar-label" title={documentLabel}>
            {documentLabel}
          </strong>
          <span className="toolbar-summary">
            {composed.layout.stats.chars}字・{composed.layout.stats.pages}ページ
          </span>
        </div>
        <div className="toolbar-actions">
          <ZoomControls {...zoomProps} className={undefined} />
          <button
            type="button"
            className="diagnostics-trigger"
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

type SettingsPanelProps = Readonly<{
  notation: ManuscriptNotation;
  composition: ManuscriptCompositionSettings;
  composed: GridComposedManuscript;
  presets: readonly ManuscriptPreset[];
  status: string;
  idPrefix?: string;
  onNotationChange: (notation: ManuscriptNotation) => void;
  onCompositionChange: (composition: ManuscriptCompositionSettings) => void;
  onPresetApply: (preset: ManuscriptPreset) => void;
  onPresetSave: (preset: ManuscriptPreset) => void;
  onPresetDelete: (name: string) => void;
}>;

type GridKey = keyof ManuscriptCompositionSettings["grid"];
type OffsetScope = keyof ManuscriptCompositionSettings["offsets"];
type OffsetEdge = "leading" | "trailing";

function numericValue(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function SettingsPanel({
  notation,
  composition,
  composed,
  presets,
  status,
  idPrefix = "",
  onNotationChange,
  onCompositionChange,
  onPresetApply,
  onPresetSave,
  onPresetDelete,
}: SettingsPanelProps) {
  const [presetName, setPresetName] = useState("");

  /**
   * Half-edited values reach here constantly; only commit settings core would accept.
   */
  const accept = (candidate: ManuscriptCompositionSettings) => {
    if (ManuscriptCompositionSettings.is(candidate)) onCompositionChange(candidate);
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
  const maximumFontSize = ManuscriptGeometry.maxFontSizePt(
    composition.grid,
    composition.appearance.paperSize,
  );

  return (
    <div className="settings-panel">
      <fieldset className="notation-controls">
        <legend>記法</legend>
        {(
          [
            ["pixiv", "Pixiv"],
            ["kakuyomu", "カクヨム"],
          ] as const satisfies ReadonlyArray<readonly [ManuscriptNotation, string]>
        ).map(([value, label]) => (
          <label key={value} htmlFor={`${idPrefix}notation-${value}`}>
            <input
              id={`${idPrefix}notation-${value}`}
              name={`${idPrefix}notation`}
              type="radio"
              checked={notation === value}
              onChange={() => {
                onNotationChange(value);
              }}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset className="controls">
        <legend>原稿用紙</legend>
        {(
          [
            ["charsPerLine", "一行の文字数"],
            ["linesPerStage", "一段の行数"],
            ["stagesPerPage", "一頁の段数"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="control" htmlFor={`${idPrefix}${key}`}>
            <span>{label}</span>
            <input
              id={`${idPrefix}${key}`}
              type="number"
              min={GridSettings.ranges[key].min}
              max={GridSettings.ranges[key].max}
              value={composition.grid[key]}
              onChange={(event) => {
                changeGrid(key, event.currentTarget.value);
              }}
            />
          </label>
        ))}
      </fieldset>

      <fieldset className="paper-controls">
        <legend>用紙と書体</legend>
        <label className="select-control">
          <span>用紙</span>
          <select
            value={composition.appearance.paperSize}
            onChange={(event) => {
              const paperSize = event.currentTarget.value;
              if (!PaperSizeId.is(paperSize)) return;
              accept({
                ...composition,
                appearance: { ...composition.appearance, paperSize },
              });
            }}
          >
            {PaperSize.all.map((paper) => (
              <option key={paper.id} value={paper.id}>
                {paper.label}
              </option>
            ))}
          </select>
        </label>
        <label className="control">
          <span>文字サイズ</span>
          <input
            type="number"
            min={FontSizePt.range.min}
            max={FontSizePt.range.max}
            step={FontSizePt.range.step}
            value={composition.appearance.fontSizePt}
            onChange={(event) => {
              const fontSizePt = numericValue(event.currentTarget.value);
              if (fontSizePt !== null) {
                accept({ ...composition, appearance: { ...composition.appearance, fontSizePt } });
              }
            }}
          />
          <small className="control-hint">pt（推奨上限 {maximumFontSize}）</small>
        </label>
        <label className="select-control">
          <span>書体</span>
          <select
            value={composition.appearance.fontPreset}
            onChange={(event) => {
              const fontPreset = event.currentTarget.value;
              if (!FontPresetId.is(fontPreset)) return;
              accept({
                ...composition,
                appearance: { ...composition.appearance, fontPreset },
              });
            }}
          >
            {FontPreset.all.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>
        </label>
        {!composed.layout.geometry.fitsPaper && (
          <p className="paper-warning">この設定では原稿用紙が用紙に収まりません。</p>
        )}
      </fieldset>

      <fieldset className="offset-controls">
        <legend>空き行</legend>
        {(
          [
            ["document", "原稿"],
            ["page", "ページ"],
            ["stage", "段"],
          ] as const
        ).flatMap(([scope, scopeLabel]) =>
          (["leading", "trailing"] as const).map((edge) => (
            <label key={`${scope}-${edge}`} className="control">
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

      <section className="presets" aria-labelledby={`${idPrefix}presets-heading`}>
        <strong id={`${idPrefix}presets-heading`}>プリセット</strong>
        <div className="preset-save">
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
        <ul className="preset-list">
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

      <dl className="stats">
        <div>
          <dt>文字数</dt>
          <dd>{composed.layout.stats.chars}</dd>
        </div>
        <div>
          <dt>ページ数</dt>
          <dd>{composed.layout.stats.pages}</dd>
        </div>
      </dl>
      <p className="status" role="status">
        {status}
      </p>
    </div>
  );
}
