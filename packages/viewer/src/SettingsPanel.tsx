import {
  DEFAULT_MANUSCRIPT_PRESET,
  FONT_PRESETS,
  FONT_SIZE_PT_RANGE,
  MAX_DOCUMENT_OFFSET,
  PAPER_SIZES,
  SETTING_RANGES,
  maxFontSizePt,
} from "@sushichan044/kg-core";
import { useState } from "react";

import type { OffsetField, SettingField } from "./Provider";
import { useManuscriptDispatch, useManuscriptState, useViewerSettings } from "./Provider";

const CONTROLS: Array<{ field: SettingField; label: string }> = [
  { field: "charsPerLine", label: "字数" },
  { field: "linesPerStage", label: "行数" },
  { field: "stagesPerPage", label: "段数" },
];

const OFFSET_CONTROLS: Array<{ field: OffsetField; label: string }> = [
  { field: "document.leading", label: "原稿全体（前）" },
  { field: "document.trailing", label: "原稿全体（後）" },
  { field: "page.leading", label: "ページ（前）" },
  { field: "page.trailing", label: "ページ（後）" },
  { field: "stage.leading", label: "段（前）" },
  { field: "stage.trailing", label: "段（後）" },
];

interface SelectControlProps {
  id: string;
  label: string;
  value: string | number;
  options: Array<{ value: string | number; label: string }>;
  onChange: (value: string) => void;
}

function SelectControl({ id, label, value, options, onChange }: SelectControlProps) {
  return (
    <div className="kgv-select-control">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface SettingsPanelProps {
  idPrefix?: string;
  status?: string;
}

export function SettingsPanel({ idPrefix = "", status = "" }: SettingsPanelProps) {
  const { settings, appearance, geometry, pagination, presets } = useManuscriptState(
    (state) => state,
  );
  const drafts = useViewerSettings();
  const dispatch = useManuscriptDispatch();
  const [newPresetName, setNewPresetName] = useState("");
  const id = (value: string) => `${idPrefix}${value}`;
  const fontSizeMax = maxFontSizePt(settings, appearance.paperSize);

  return (
    <div className="kgv-settings-panel">
      <fieldset className="kgv-controls">
        <legend>組版</legend>
        {CONTROLS.map(({ field, label }) => {
          const range = SETTING_RANGES[field];
          const inputId = id(`input-${field}`);
          const hintId = id(`hint-${field}`);
          return (
            <div className="kgv-control" key={field}>
              <label htmlFor={inputId}>{label}</label>
              <input
                id={inputId}
                type="number"
                inputMode="numeric"
                min={range.min}
                max={range.max}
                step={1}
                value={drafts.settings[field]}
                aria-invalid={drafts.invalidSettings[field]}
                aria-describedby={hintId}
                onChange={(event) => {
                  drafts.setSetting(field, event.target.value);
                }}
              />
              <span id={hintId} className="kgv-control-hint">
                {range.min}–{range.max}
              </span>
            </div>
          );
        })}
      </fieldset>

      <fieldset className="kgv-paper-controls">
        <legend>紙面</legend>
        <SelectControl
          id={id("paper-size")}
          label="用紙"
          value={appearance.paperSize}
          options={PAPER_SIZES.map((paper) => ({ value: paper.id, label: paper.label }))}
          onChange={(value) => {
            const selected = PAPER_SIZES.find((paper) => paper.id === value);
            if (selected !== undefined) {
              dispatch({ type: "config.patch", patch: { appearance: { paperSize: selected.id } } });
            }
          }}
        />
        <div className="kgv-control">
          <label htmlFor={id("font-size-pt")}>文字サイズ (pt)</label>
          <input
            id={id("font-size-pt")}
            type="number"
            inputMode="decimal"
            min={FONT_SIZE_PT_RANGE.min}
            max={FONT_SIZE_PT_RANGE.max}
            step={FONT_SIZE_PT_RANGE.step}
            value={drafts.fontSizePt}
            aria-invalid={drafts.isFontSizePtInvalid}
            aria-describedby={id("font-size-pt-hint")}
            onChange={(event) => {
              drafts.setFontSizePt(event.target.value);
            }}
          />
          <span id={id("font-size-pt-hint")} className="kgv-control-hint">
            {FONT_SIZE_PT_RANGE.min}–{FONT_SIZE_PT_RANGE.max}pt（この用紙・組版なら最大約
            {fontSizeMax}pt） ・ 余白 天地{geometry.marginBlockMm.toFixed(1)}mm / 左右
            {geometry.marginInlineMm.toFixed(1)}mm
          </span>
          {!geometry.fitsPaper && (
            <p className="kgv-paper-warning" role="alert">
              指定した文字サイズが用紙からはみ出しています。文字サイズを小さくしてください。
            </p>
          )}
        </div>
        <SelectControl
          id={id("manuscript-font")}
          label="書体"
          value={appearance.fontPreset}
          options={FONT_PRESETS.map((font) => ({ value: font.id, label: font.label }))}
          onChange={(value) => {
            const selected = FONT_PRESETS.find((font) => font.id === value);
            if (selected !== undefined) {
              dispatch({
                type: "config.patch",
                patch: { appearance: { fontPreset: selected.id } },
              });
            }
          }}
        />
        <p className="kgv-paper-note">余白は文字サイズと組版設定から自動計算されます。</p>
      </fieldset>

      <fieldset className="kgv-offset-controls">
        <legend>オフセット（行）</legend>
        {OFFSET_CONTROLS.map(({ field, label }) => {
          const inputId = id(`offset-${field}`);
          const hintId = id(`offset-hint-${field}`);
          const documentScope = field.startsWith("document.");
          return (
            <div className="kgv-control" key={field}>
              <label htmlFor={inputId}>{label}</label>
              <input
                id={inputId}
                type="number"
                inputMode="numeric"
                min={0}
                max={documentScope ? MAX_DOCUMENT_OFFSET : undefined}
                step={1}
                value={drafts.offsets[field]}
                aria-invalid={drafts.invalidOffsets[field]}
                aria-describedby={hintId}
                onChange={(event) => {
                  drafts.setOffset(field, event.target.value);
                }}
              />
              <span id={hintId} className="kgv-control-hint">
                {documentScope ? `0–${MAX_DOCUMENT_OFFSET}の整数` : "0以上の整数"}
              </span>
            </div>
          );
        })}
        <p className="kgv-offset-note">
          大きすぎる値は、各ページ・各段に最低1行残るよう自動的に調整されます。
        </p>
      </fieldset>

      <div className="kgv-presets">
        <label htmlFor={id("preset-apply")}>プリセット</label>
        <select
          id={id("preset-apply")}
          value=""
          onChange={(event) => {
            if (event.target.value !== "") {
              dispatch({ type: "preset.apply", name: event.target.value });
            }
          }}
        >
          <option value="">適用するプリセットを選択…</option>
          <option value={DEFAULT_MANUSCRIPT_PRESET.name}>{DEFAULT_MANUSCRIPT_PRESET.name}</option>
          {presets.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
        <div className="kgv-preset-save">
          <label htmlFor={id("preset-name")} className="kgv-visually-hidden">
            新しいプリセット名
          </label>
          <input
            id={id("preset-name")}
            type="text"
            placeholder="現在の設定を保存"
            value={newPresetName}
            onChange={(event) => {
              setNewPresetName(event.target.value);
            }}
          />
          <button
            type="button"
            disabled={newPresetName.trim() === ""}
            onClick={() => {
              const result = dispatch({
                type: "preset.save",
                name: newPresetName,
                overwrite: false,
              });
              if (
                result.issues[0]?.code === "preset-exists" &&
                window.confirm("同名のプリセットを上書きしますか？")
              ) {
                dispatch({ type: "preset.save", name: newPresetName, overwrite: true });
              }
              setNewPresetName("");
            }}
          >
            保存
          </button>
        </div>
        {presets.length > 0 && (
          <ul className="kgv-preset-list">
            {presets.map((preset) => (
              <li key={preset.name}>
                <span>{preset.name}</span>
                <button
                  type="button"
                  aria-label={`プリセット「${preset.name}」を削除`}
                  onClick={() => {
                    if (window.confirm(`プリセット「${preset.name}」を削除しますか？`)) {
                      dispatch({ type: "preset.delete", name: preset.name });
                    }
                  }}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dl className="kgv-stats">
        <div>
          <dt>文字数</dt>
          <dd>{pagination.stats.chars}</dd>
        </div>
        <div>
          <dt>行数</dt>
          <dd>{pagination.stats.sourceLines}</dd>
        </div>
        <div>
          <dt>ページ</dt>
          <dd>{pagination.stats.pages}</dd>
        </div>
      </dl>
      <p className="kgv-status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
