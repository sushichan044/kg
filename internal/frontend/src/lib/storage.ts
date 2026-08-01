// Persistence for the viewer's display settings. The payload carries a
// top-level `version` so that when display requirements change we can either
// migrate an old shape or discard it and fall back to defaults, rather than
// loading settings the current UI can no longer honor.

import {
  DEFAULT_APPEARANCE,
  DEFAULT_OFFSETS,
  DEFAULT_ZOOM,
  DEFAULT_SETTINGS,
  SETTING_RANGES,
  isFixedZoomPercent,
  isFontPresetId,
  isFontSizePt,
  isPaperSizeId,
} from "@sushichan044/kg-core";
import type {
  GridSettings,
  LineOffset,
  ManuscriptAppearanceSettings,
  ManuscriptOffsets,
  ZoomMode,
} from "@sushichan044/kg-core";

const STORAGE_KEY = "kg.viewer.state.v3";
const V2_STORAGE_KEY = "kg.viewer.state.v2";
const STATE_VERSION = 3;

export interface Preset {
  name: string;
  settings: GridSettings;
  appearance: ManuscriptAppearanceSettings;
  offsets: ManuscriptOffsets;
}

export interface ViewerState {
  selectedPath: string | null;
  settings: GridSettings;
  appearance: ManuscriptAppearanceSettings;
  offsets: ManuscriptOffsets;
  zoom: ZoomMode;
  presets: Preset[];
}

const DEFAULT_STATE: ViewerState = {
  selectedPath: null,
  settings: DEFAULT_SETTINGS,
  appearance: DEFAULT_APPEARANCE,
  offsets: DEFAULT_OFFSETS,
  zoom: DEFAULT_ZOOM,
  presets: [],
};

function isValidSettings(value: unknown): value is GridSettings {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;

  return (["charsPerLine", "linesPerStage", "stagesPerPage"] as const).every((key) => {
    const n = record[key];
    const range = SETTING_RANGES[key];

    return typeof n === "number" && Number.isInteger(n) && n >= range.min && n <= range.max;
  });
}

function parseAppearance(value: unknown): ManuscriptAppearanceSettings | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    !isPaperSizeId(record.paperSize) ||
    !isFontSizePt(record.fontSizePt) ||
    !isFontPresetId(record.fontPreset)
  ) {
    return null;
  }

  return {
    paperSize: record.paperSize,
    fontSizePt: record.fontSizePt,
    fontPreset: record.fontPreset,
  };
}

function isLineOffset(value: unknown): value is LineOffset {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;

  return (["leading", "trailing"] as const).every((key) => {
    const n = record[key];

    return typeof n === "number" && Number.isInteger(n) && n >= 0;
  });
}

function parseOffsets(value: unknown): ManuscriptOffsets | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!isLineOffset(record.document) || !isLineOffset(record.page) || !isLineOffset(record.stage)) {
    return null;
  }

  return { document: record.document, page: record.page, stage: record.stage };
}

function parseZoom(value: unknown): ZoomMode | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.mode === "fit") {
    return { mode: "fit" };
  }
  if (record.mode === "fixed" && isFixedZoomPercent(record.percent)) {
    return { mode: "fixed", percent: record.percent };
  }

  return null;
}

function migrateCurrent(parsed: unknown): ViewerState | null {
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const obj = parsed as Record<string, unknown>;

  if (obj.version !== STATE_VERSION) {
    return null;
  }
  if (!isValidSettings(obj.settings)) {
    return null;
  }

  return {
    selectedPath: typeof obj.selectedPath === "string" ? obj.selectedPath : null,
    settings: obj.settings,
    appearance: parseAppearance(obj.appearance) ?? DEFAULT_APPEARANCE,
    offsets: parseOffsets(obj.offsets) ?? DEFAULT_OFFSETS,
    zoom: parseZoom(obj.zoom) ?? DEFAULT_ZOOM,
    presets: parsePresets(obj.presets),
  };
}

// v2 stored `marginMm` instead of `fontSizePt` and had no `offsets`. Carry
// over paper size and font preset only; default the new fields rather than
// back-converting a margin into a point size.
function migrateV2Appearance(value: unknown): ManuscriptAppearanceSettings {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_APPEARANCE;
  }
  const record = value as Record<string, unknown>;

  return {
    paperSize: isPaperSizeId(record.paperSize) ? record.paperSize : DEFAULT_APPEARANCE.paperSize,
    fontSizePt: DEFAULT_APPEARANCE.fontSizePt,
    fontPreset: isFontPresetId(record.fontPreset)
      ? record.fontPreset
      : DEFAULT_APPEARANCE.fontPreset,
  };
}

function migrateV2(parsed: unknown): ViewerState | null {
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.version !== 2 || !isValidSettings(obj.settings)) {
    return null;
  }

  return {
    selectedPath: typeof obj.selectedPath === "string" ? obj.selectedPath : null,
    settings: obj.settings,
    appearance: migrateV2Appearance(obj.appearance),
    offsets: DEFAULT_OFFSETS,
    zoom: parseZoom(obj.zoom) ?? DEFAULT_ZOOM,
    presets: migrateV2Presets(obj.presets),
  };
}

function parsePresets(value: unknown): Preset[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const presets: Preset[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const rec = item as Record<string, unknown>;
    if (typeof rec.name === "string" && isValidSettings(rec.settings)) {
      presets.push({
        name: rec.name,
        settings: rec.settings,
        appearance: parseAppearance(rec.appearance) ?? DEFAULT_APPEARANCE,
        offsets: parseOffsets(rec.offsets) ?? DEFAULT_OFFSETS,
      });
    }
  }

  return presets;
}

function migrateV2Presets(value: unknown): Preset[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const presets: Preset[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const rec = item as Record<string, unknown>;
    if (typeof rec.name === "string" && isValidSettings(rec.settings)) {
      presets.push({
        name: rec.name,
        settings: rec.settings,
        appearance: migrateV2Appearance(rec.appearance),
        offsets: DEFAULT_OFFSETS,
      });
    }
  }

  return presets;
}

export function loadState(): ViewerState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) {
    try {
      const current = migrateCurrent(JSON.parse(raw));
      if (current !== null) {
        return current;
      }
    } catch {
      // Continue to the v2 key so a partial v3 write does not hide valid v2 state.
    }
  }

  try {
    const legacy = localStorage.getItem(V2_STORAGE_KEY);

    return legacy === null ? DEFAULT_STATE : (migrateV2(JSON.parse(legacy)) ?? DEFAULT_STATE);
  } catch {
    return DEFAULT_STATE;
  }
}

// saveState persists the state and reports whether it succeeded so the caller
// can surface a storage failure to the user.
export function saveState(state: ViewerState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STATE_VERSION, ...state }));

    return true;
  } catch {
    return false;
  }
}

// The last visible page per file is ephemeral, per-tab state, so it lives in
// sessionStorage rather than the persisted settings.
const PAGE_KEY_PREFIX = "kg.viewer.page:";

export function loadPage(path: string): number {
  try {
    const raw = sessionStorage.getItem(PAGE_KEY_PREFIX + path);
    if (raw === null) {
      return 0;
    }
    const n = Number.parseInt(raw, 10);

    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function savePage(path: string, page: number): void {
  try {
    sessionStorage.setItem(PAGE_KEY_PREFIX + path, String(page));
  } catch {
    // Ignore storage failures for ephemeral scroll state.
  }
}
