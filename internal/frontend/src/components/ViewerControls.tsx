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
import DiagnosticsIcon from "~icons/lucide/message-square-warning";
import MinusIcon from "~icons/lucide/minus";
import PanelLeftIcon from "~icons/lucide/panel-left";
import PlusIcon from "~icons/lucide/plus";
import FitIcon from "~icons/lucide/scan";
import SearchIcon from "~icons/lucide/search";

import type { ManuscriptNotation } from "../lib/storage";
import { IconButton } from "./IconButton";

type ZoomControlsProps = Readonly<{
  zoom: number;
  fit: boolean;
  className?: string;
  onZoomChange: (zoom: number) => void;
  onFitChange: (fit: boolean) => void;
}>;

export const ZOOM = { min: 25, max: 400, step: 25 } as const;

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
      <IconButton
        label="縮小"
        disabled={zoomOut === null}
        onClick={() => {
          if (zoomOut !== null) onZoomChange(zoomOut);
        }}
      >
        <MinusIcon aria-hidden="true" />
      </IconButton>
      <span className="zoom-value" role="status" aria-label="現在のズーム">
        {Math.round(zoom)}%
      </span>
      <IconButton
        label="拡大"
        disabled={zoomIn === null}
        onClick={() => {
          if (zoomIn !== null) onZoomChange(zoomIn);
        }}
      >
        <PlusIcon aria-hidden="true" />
      </IconButton>
      <IconButton
        label="ページに合わせる"
        aria-pressed={fit}
        onClick={() => {
          onFitChange(true);
        }}
      >
        <FitIcon aria-hidden="true" />
      </IconButton>
    </div>
  );
}

type ViewerToolbarProps = ZoomControlsProps &
  Readonly<{
    documentLabel: string;
    composed: NovelComposedManuscript | null;
    diagnosticCount: number;
    onDiagnosticsOpen: () => void;
    sidebarOpen: boolean;
    onSidebarToggle: () => void;
    onFilesOpen: () => void;
  }>;

export function ViewerToolbar({
  documentLabel,
  composed,
  diagnosticCount,
  onDiagnosticsOpen,
  sidebarOpen,
  onSidebarToggle,
  onFilesOpen,
  ...zoomProps
}: ViewerToolbarProps) {
  return (
    <div className={classNames("toolbar-container", zoomProps.className)}>
      <div className="toolbar">
        <IconButton
          label="サイドバー"
          aria-expanded={sidebarOpen}
          aria-controls="workspace-sidebar"
          onClick={onSidebarToggle}
        >
          <PanelLeftIcon aria-hidden="true" />
        </IconButton>
        <IconButton
          label="ファイルを検索"
          shortcut="⌘K / Ctrl K"
          aria-keyshortcuts="Meta+K Control+K"
          className="file-search-trigger"
          onClick={onFilesOpen}
        >
          <SearchIcon aria-hidden="true" />
        </IconButton>
        <div className="toolbar-document">
          <strong className="toolbar-label" title={documentLabel}>
            {documentLabel}
          </strong>
          {composed !== null && (
            <span className="toolbar-summary">
              {composed.layout.stats.chars}字・{composed.layout.stats.pages}ページ
            </span>
          )}
        </div>
        <div className="toolbar-actions">
          <ZoomControls {...zoomProps} className={undefined} />
          <IconButton
            label={`診断 ${diagnosticCount}件`}
            className="diagnostics-trigger"
            onClick={onDiagnosticsOpen}
          >
            <DiagnosticsIcon aria-hidden="true" /> <span>{diagnosticCount}</span>
          </IconButton>
        </div>
      </div>
    </div>
  );
}

type SettingsPanelProps = Readonly<{
  notation: ManuscriptNotation;
  composition: NovelCompositionSettings;
  showGrid: boolean;
  spread: boolean;
  startPageSide: "left" | "right";
  onSpreadChange: (spread: boolean) => void;
  onStartPageSideChange: (side: "left" | "right") => void;
  status: string;
  idPrefix?: string;
  onNotationChange: (notation: ManuscriptNotation) => void;
  onCompositionChange: (composition: NovelCompositionSettings) => void;
  onGridChange: (showGrid: boolean) => void;
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
  spread,
  startPageSide,
  onSpreadChange,
  onStartPageSideChange,
  status,
  idPrefix = "",
  onNotationChange,
  onCompositionChange,
  onGridChange,
}: SettingsPanelProps) {
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
      <details className="settings-section">
        <summary>記法</summary>
        <fieldset className="notation-controls">
          <legend className="visually-hidden">記法</legend>
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
      </details>
      <details className="settings-section">
        <summary>表示</summary>
        <fieldset className="notation-controls">
          <legend className="visually-hidden">表示</legend>
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
          <label htmlFor={`${idPrefix}spread`}>
            <input
              id={`${idPrefix}spread`}
              type="checkbox"
              checked={spread}
              onChange={(event) => {
                onSpreadChange(event.currentTarget.checked);
              }}
            />
            見開き表示
          </label>
          <label htmlFor={`${idPrefix}start-page-side`}>
            開始ページの位置
            <select
              id={`${idPrefix}start-page-side`}
              value={startPageSide}
              onChange={(event) => {
                onStartPageSideChange(event.currentTarget.value === "left" ? "left" : "right");
              }}
            >
              <option value="right">右</option>
              <option value="left">左</option>
            </select>
          </label>
        </fieldset>
      </details>
      <details className="settings-section">
        <summary>用紙・組版・書体</summary>
        {fixed ? (
          <details className="fixed-format">
            <summary>{composition.appearance.paperSize.toUpperCase()}固定組版</summary>
            <p>
              {composition.flow.lineLengthEm}字×{composition.flow.linesPerStage}行×
              {composition.flow.stagesPerPage}段、文字サイズ{composition.appearance.fontSizeQ}Q
            </p>
            <p>
              行間{composition.page.lineGapMm * 4}H、行送り
              {composition.appearance.fontSizeQ + composition.page.lineGapMm * 4}H、段間
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
      </details>
      {status && (
        <p className="status" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
