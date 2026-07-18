// Persistence for the viewer's display settings. The payload carries a
// top-level `version` so that when display requirements change we can either
// migrate an old shape or discard it and fall back to defaults, rather than
// loading settings the current UI can no longer honor.

import { DEFAULT_SETTINGS, SETTING_RANGES } from "./pagination";
import type { GridSettings } from "./pagination";

const STORAGE_KEY = "kg.viewer.state.v1";
const STATE_VERSION = 1;

export interface Preset {
  name: string;
  settings: GridSettings;
}

export interface ViewerState {
  selectedPath: string | null;
  settings: GridSettings;
  presets: Preset[];
}

const DEFAULT_STATE: ViewerState = {
  selectedPath: null,
  settings: DEFAULT_SETTINGS,
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

// migrate turns a raw persisted payload into a valid ViewerState, or returns
// null when it is incompatible. Future versions add cases here to transform old
// shapes; unknown versions and invalid data are discarded.
function migrate(parsed: unknown): ViewerState | null {
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
    presets: parsePresets(obj.presets),
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
      presets.push({ name: rec.name, settings: rec.settings });
    }
  }

  return presets;
}

export function loadState(): ViewerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return DEFAULT_STATE;
    }

    return migrate(JSON.parse(raw)) ?? DEFAULT_STATE;
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
