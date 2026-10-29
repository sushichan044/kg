import {
  FontPreset,
  FontPresetId,
  FontSizeQ,
  NovelCompositionSettings,
  NovelFlowSettings,
  ManuscriptPageSettings,
  PaperSize,
  PaperSizeId,
} from "@sushichan044/kg-core";
import type { NovelComposedManuscript } from "@sushichan044/kg-core";
import { useState } from "react";
import * as v from "valibot";

import type { ManuscriptNotation, ManuscriptPreset } from "../lib/storage";

type ZoomControlsProps = Readonly<{
  zoom: number;
  fit: boolean;
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
  className,
  onZoomChange,
  onFitChange,
}: ZoomControlsProps) {
  const zoomOut = zoom > ZOOM.min ? Math.max(ZOOM.min, zoom - ZOOM.step) : null;
  const zoomIn = zoom < ZOOM.max ? Math.min(ZOOM.max, zoom + ZOOM.step) : null;
  return (
    <div className={classNames("zoom-controls", className)} aria-label="ズーム">
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
        ページに合わせる
      </button>
    </div>
  );
}

type ViewerToolbarProps = ZoomControlsProps &
  Readonly<{
    documentLabel: string;
    composed: NovelComposedManuscript;
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
  composition: NovelCompositionSettings;
  showGrid: boolean;
  presets: readonly ManuscriptPreset[];
  status: string;
  idPrefix?: string;
  onNotationChange: (notation: ManuscriptNotation) => void;
  onCompositionChange: (composition: NovelCompositionSettings) => void;
  onGridChange: (showGrid: boolean) => void;
  onPresetApply: (preset: ManuscriptPreset) => void;
  onPresetSave: (preset: ManuscriptPreset) => void;
  onPresetDelete: (name: string) => void;
}>;

type FlowKey = keyof NovelCompositionSettings["flow"];
type OffsetScope = keyof NovelCompositionSettings["offsets"];
type OffsetEdge = "leading" | "trailing";

function numericValue(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function SettingsPanel({
  notation,
  composition: savedComposition,
  showGrid,
  presets,
  status,
  idPrefix = "",
  onNotationChange,
  onCompositionChange,
  onGridChange,
  onPresetApply,
  onPresetSave,
  onPresetDelete,
}: SettingsPanelProps) {
  const [presetName, setPresetName] = useState("");
  const [pending, setPending] = useState<Readonly<{
    base: NovelCompositionSettings;
    value: NovelCompositionSettings;
  }> | null>(null);
  const draft = pending?.base === savedComposition ? pending.value : null;
  const composition = draft ?? savedComposition;
  const fixed =
    composition.appearance.paperSize === "a5" || composition.appearance.paperSize === "a6";

  const accept = (candidate: NovelCompositionSettings) => {
    const result = v.safeParse(NovelCompositionSettings.schema, candidate);
    if (result.success) {
      setPending(null);
      onCompositionChange(result.output);
    } else {
      setPending({ base: savedComposition, value: candidate });
    }
  };
  const recenter = (candidate: NovelCompositionSettings) => {
    accept({
      ...candidate,
      page: ManuscriptPageSettings.centered(candidate.flow, candidate.appearance),
    });
  };
  const changeFlow = (key: FlowKey, value: string) => {
    const parsed = numericValue(value);
    if (parsed === null) return;
    recenter({ ...composition, flow: { ...composition.flow, [key]: parsed } });
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
      <fieldset className="notation-controls">
        <legend>表示</legend>
        <label htmlFor={`${idPrefix}show-grid`}>
          <input
            id={`${idPrefix}show-grid`}
            type="checkbox"
            checked={showGrid}
            onChange={(event) => {
              onGridChange(event.currentTarget.checked);
            }}
          />
          マス目
        </label>
      </fieldset>
      {fixed ? (
        <details className="fixed-format">
          <summary>{composition.appearance.paperSize.toUpperCase()}固定組版</summary>
          <p>
            {composition.flow.lineLengthEm}字×{composition.flow.linesPerStage}行×
            {composition.flow.stagesPerPage}段、文字サイズ{composition.appearance.fontSizeQ}Q
          </p>
          <p>
            行間{composition.page.lineGapMm}mm、行送り
            {composition.appearance.fontSizeQ / 4 + composition.page.lineGapMm}mm、段間
            {composition.page.stageGapMm}mm
          </p>
          <p>
            天{composition.page.topMm}mm、地{composition.page.bottomMm}mm、ノド
            {composition.page.innerMm}mm、小口{composition.page.outerMm}mm
          </p>
        </details>
      ) : (
        <fieldset className="controls">
          <legend>組版</legend>
          {(
            [
              ["lineLengthEm", "一行の字数"],
              ["linesPerStage", "一段の行数"],
              ["stagesPerPage", "一頁の段数"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="control" htmlFor={`${idPrefix}${key}`}>
              <span>{label}</span>
              <input
                id={`${idPrefix}${key}`}
                type="number"
                min={NovelFlowSettings.ranges[key].min}
                max={NovelFlowSettings.ranges[key].max}
                value={composition.flow[key]}
                onChange={(event) => {
                  changeFlow(key, event.currentTarget.value);
                }}
              />
            </label>
          ))}
        </fieldset>
      )}

      <fieldset className="paper-controls">
        <legend>用紙と書体</legend>
        <label className="select-control">
          <span>用紙</span>
          <select
            value={composition.appearance.paperSize}
            onChange={(event) => {
              const paperSize = event.currentTarget.value;
              if (!PaperSizeId.is(paperSize)) return;
              accept(NovelCompositionSettings.forPaper(paperSize, composition));
            }}
          >
            {PaperSize.all.map((paper) => (
              <option key={paper.id} value={paper.id}>
                {paper.label}
              </option>
            ))}
          </select>
        </label>
        {!fixed && (
          <label className="control">
            <span>文字サイズ（Q）</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={composition.appearance.fontSizeQ}
              onChange={(event) => {
                const fontSizeQ = numericValue(event.currentTarget.value);
                if (fontSizeQ !== null && FontSizeQ.is(fontSizeQ)) {
                  recenter({
                    ...composition,
                    appearance: { ...composition.appearance, fontSizeQ },
                  });
                }
              }}
            />
          </label>
        )}
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
        {draft !== null && (
          <p className="paper-warning" role="alert">
            用紙に収まりません。字数・行数・段数・文字サイズ・空き行を調整してください。
          </p>
        )}
      </fieldset>

      <details className="settings-details">
        <summary>空き行</summary>
        <fieldset className="offset-controls">
          <legend className="visually-hidden">空き行</legend>
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
      </details>

      <section className="presets" aria-labelledby={`${idPrefix}presets-heading`}>
        <strong id={`${idPrefix}presets-heading`}>プリセット</strong>
        <div className="preset-save">
          <label className="visually-hidden" htmlFor={`${idPrefix}preset-name`}>
            プリセット名
          </label>
          <input
            id={`${idPrefix}preset-name`}
            placeholder="プリセット名"
            value={presetName}
            onChange={(event) => {
              setPresetName(event.currentTarget.value);
            }}
          />
          <button
            type="button"
            disabled={presetName.trim() === "" || draft !== null}
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
                  setPending(null);
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

      {status && (
        <p className="status" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
