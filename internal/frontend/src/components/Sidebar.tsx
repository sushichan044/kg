import { useState } from "react";

import type { FileEntry } from "../lib/api";
import { FONT_PRESETS, MARGIN_OPTIONS, PAPER_SIZES } from "../lib/manuscriptAppearance";
import type {
  FontPresetId,
  ManuscriptAppearanceSettings,
  MarginMm,
  PaperSizeId,
} from "../lib/manuscriptAppearance";
import { SETTING_RANGES } from "../lib/pagination";
import type { GridSettings, Statistics } from "../lib/pagination";
import type { Preset } from "../lib/storage";

type SettingField = keyof GridSettings;

const CONTROLS: Array<{ field: SettingField; label: string }> = [
  { field: "charsPerLine", label: "字数" },
  { field: "linesPerStage", label: "行数" },
  { field: "stagesPerPage", label: "段数" },
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
    <div className="select-control">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface SidebarProps {
  files: FileEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  drafts: Record<SettingField, string>;
  invalid: Record<SettingField, boolean>;
  onSettingChange: (field: SettingField, raw: string) => void;
  appearance: ManuscriptAppearanceSettings;
  onPaperSizeChange: (paperSize: PaperSizeId) => void;
  onMarginChange: (marginMm: MarginMm) => void;
  onFontPresetChange: (fontPreset: FontPresetId) => void;
  presets: Preset[];
  builtinPresetName: string;
  onApplyPreset: (name: string) => void;
  onSavePreset: (name: string) => void;
  onDeletePreset: (name: string) => void;
  stats: Statistics;
  status: string;
}

export function Sidebar(props: SidebarProps) {
  const {
    files,
    selectedId,
    onSelect,
    drafts,
    invalid,
    onSettingChange,
    appearance,
    onPaperSizeChange,
    onMarginChange,
    onFontPresetChange,
    presets,
    builtinPresetName,
    onApplyPreset,
    onSavePreset,
    onDeletePreset,
    stats,
    status,
  } = props;

  const [newPresetName, setNewPresetName] = useState("");

  const handleSave = () => {
    onSavePreset(newPresetName);
    setNewPresetName("");
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand__name">kg</span>
        <span className="brand__mode">原稿用紙</span>
      </div>

      <nav className="files" aria-label="ファイル">
        {files.length === 0 ? (
          <p className="files__empty">.txt ファイルがありません</p>
        ) : (
          <ul className="file-list">
            {files.map((file) => (
              <li key={file.id}>
                <button
                  type="button"
                  className="file-list__item"
                  aria-current={file.id === selectedId ? "page" : undefined}
                  onClick={() => onSelect(file.id)}
                >
                  {file.path}
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <fieldset className="controls">
        <legend>組版</legend>
        {CONTROLS.map(({ field, label }) => {
          const range = SETTING_RANGES[field];
          const hintId = `hint-${field}`;

          return (
            <div className="control" key={field}>
              <label htmlFor={`input-${field}`}>{label}</label>
              <input
                id={`input-${field}`}
                type="number"
                inputMode="numeric"
                min={range.min}
                max={range.max}
                step={1}
                value={drafts[field]}
                aria-invalid={invalid[field]}
                aria-describedby={hintId}
                onChange={(e) => onSettingChange(field, e.target.value)}
              />
              <span id={hintId} className="control__hint">
                {range.min}–{range.max}
              </span>
            </div>
          );
        })}
      </fieldset>

      <fieldset className="paper-controls">
        <legend>紙面</legend>

        <SelectControl
          id="paper-size"
          label="用紙"
          value={appearance.paperSize}
          options={PAPER_SIZES.map((paper) => ({ value: paper.id, label: paper.label }))}
          onChange={(value) => {
            const selected = PAPER_SIZES.find((paper) => paper.id === value);
            if (selected) {
              onPaperSizeChange(selected.id);
            }
          }}
        />

        <SelectControl
          id="paper-margin"
          label="最低余白"
          value={appearance.marginMm}
          options={MARGIN_OPTIONS.map((margin) => ({ value: margin, label: `${margin}mm` }))}
          onChange={(value) => {
            const selected = MARGIN_OPTIONS.find((margin) => margin === Number(value));
            if (selected !== undefined) {
              onMarginChange(selected);
            }
          }}
        />

        <SelectControl
          id="manuscript-font"
          label="書体"
          value={appearance.fontPreset}
          options={FONT_PRESETS.map((font) => ({ value: font.id, label: font.label }))}
          onChange={(value) => {
            const selected = FONT_PRESETS.find((font) => font.id === value);
            if (selected) {
              onFontPresetChange(selected.id);
            }
          }}
        />

        <p className="paper-controls__note">紙面と文字サイズは概算です。</p>
      </fieldset>

      <div className="presets">
        <label htmlFor="preset-apply">プリセット</label>
        <select
          id="preset-apply"
          value=""
          onChange={(e) => {
            if (e.target.value !== "") {
              onApplyPreset(e.target.value);
            }
          }}
        >
          <option value="">適用するプリセットを選択…</option>
          <option value={builtinPresetName}>{builtinPresetName}</option>
          {presets.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>

        <div className="preset-save">
          <label htmlFor="preset-name" className="visually-hidden">
            新しいプリセット名
          </label>
          <input
            id="preset-name"
            type="text"
            placeholder="現在の設定を保存"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
          />
          <button type="button" onClick={handleSave} disabled={newPresetName.trim() === ""}>
            保存
          </button>
        </div>

        {presets.length > 0 && (
          <ul className="preset-list">
            {presets.map((preset) => (
              <li key={preset.name}>
                <span>{preset.name}</span>
                <button
                  type="button"
                  aria-label={`プリセット「${preset.name}」を削除`}
                  onClick={() => onDeletePreset(preset.name)}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dl className="stats">
        <div className="stats__row">
          <dt>文字数</dt>
          <dd className="stats__num">{stats.chars}</dd>
        </div>
        <div className="stats__row">
          <dt>行数</dt>
          <dd className="stats__num">{stats.sourceLines}</dd>
        </div>
        <div className="stats__row">
          <dt>ページ</dt>
          <dd className="stats__num">{stats.pages}</dd>
        </div>
      </dl>

      <p className="status" aria-live="polite">
        {status}
      </p>
    </aside>
  );
}
