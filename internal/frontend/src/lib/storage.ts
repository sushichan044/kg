import {
  DEFAULT_APPEARANCE,
  DEFAULT_OFFSETS,
  DEFAULT_PROOFREADING_OPTIONS,
  DEFAULT_SETTINGS,
  DEFAULT_ZOOM,
  decodeManuscriptPreferences,
  encodeManuscriptPreferences,
} from "@sushichan044/kg-core";
import type { ManuscriptPreferences, ManuscriptState } from "@sushichan044/kg-core";
import * as v from "valibot";

const APP_STATE_KEY = "kg.app.state.v1";
const PREFERENCES_KEY = "kg.manuscript.preferences.v2";
const PAGE_KEY_PREFIX = "kg.app.page.v1:";

const AppStateSchema = v.object({
  version: v.literal(1),
  selectedPath: v.nullable(v.string()),
});

const PageSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

export type AppState = v.InferOutput<typeof AppStateSchema>;

export const DEFAULT_APP_STATE: AppState = { version: 1, selectedPath: null };

export const DEFAULT_MANUSCRIPT_PREFERENCES: ManuscriptPreferences = {
  settings: DEFAULT_SETTINGS,
  appearance: DEFAULT_APPEARANCE,
  offsets: DEFAULT_OFFSETS,
  proofreading: DEFAULT_PROOFREADING_OPTIONS,
  zoom: DEFAULT_ZOOM,
  presets: [],
};

function readJson(key: string): unknown {
  const raw = localStorage.getItem(key);
  return raw === null ? null : JSON.parse(raw);
}

export function loadAppState(): AppState {
  try {
    const result = v.safeParse(AppStateSchema, readJson(APP_STATE_KEY));
    return result.success ? result.output : DEFAULT_APP_STATE;
  } catch {
    return DEFAULT_APP_STATE;
  }
}

export function saveAppState(state: AppState): boolean {
  try {
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(v.parse(AppStateSchema, state)));
    return true;
  } catch {
    return false;
  }
}

export function loadManuscriptPreferences(): ManuscriptPreferences {
  try {
    const result = decodeManuscriptPreferences(readJson(PREFERENCES_KEY));
    return result.ok ? result.value : DEFAULT_MANUSCRIPT_PREFERENCES;
  } catch {
    return DEFAULT_MANUSCRIPT_PREFERENCES;
  }
}

export function saveManuscriptPreferences(state: ManuscriptState): boolean {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(encodeManuscriptPreferences(state)));
    return true;
  } catch {
    return false;
  }
}

export function loadPage(path: string): number {
  try {
    const raw = sessionStorage.getItem(PAGE_KEY_PREFIX + path);
    if (raw === null) return 0;
    const result = v.safeParse(PageSchema, Number(raw));
    return result.success ? result.output : 0;
  } catch {
    return 0;
  }
}

export function savePage(path: string, page: number): void {
  const result = v.safeParse(PageSchema, page);
  if (!result.success) return;
  try {
    sessionStorage.setItem(PAGE_KEY_PREFIX + path, String(result.output));
  } catch {
    // Page restoration is best-effort session state.
  }
}
