import { ManuscriptCompositionSettings } from "@sushichan044/kg-core";
import * as v from "valibot";

const APP_STATE_KEY = "kg.app.state.v1";
const PREFERENCES_KEY = "kg.manuscript.preferences.v5";
const LEGACY_PREFERENCES_V4_KEY = "kg.manuscript.preferences.v4";
const LEGACY_PREFERENCES_V3_KEY = "kg.manuscript.preferences.v3";
const PAGE_KEY_PREFIX = "kg.app.page.v1:";

const readonlyObject = <const TEntries extends v.ObjectEntries>(entries: TEntries) =>
  v.pipe(v.strictObject(entries), v.readonly());

const AppStateSchema = readonlyObject({
  version: v.literal(1),
  selectedPath: v.nullable(v.string()),
});

const LegacyZoomModeSchema = v.variant("kind", [
  readonlyObject({ kind: v.literal("fit") }),
  readonlyObject({
    kind: v.literal("fixed"),
    // The viewer accepts any magnification; a stored one only has to be usable.
    percent: v.pipe(v.number(), v.finite(), v.minValue(1)),
  }),
]);

const ManuscriptPresetSchema = readonlyObject({
  name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  composition: ManuscriptCompositionSettings.schema,
});

const ManuscriptPreferencesV3Schema = readonlyObject({
  version: v.literal(3),
  composition: ManuscriptCompositionSettings.schema,
  zoom: LegacyZoomModeSchema,
  presets: v.pipe(v.array(ManuscriptPresetSchema), v.readonly()),
});

const ManuscriptPreferencesSchema = readonlyObject({
  version: v.literal(5),
  notation: v.union([v.literal("pixiv"), v.literal("kakuyomu")]),
  composition: ManuscriptCompositionSettings.schema,
  zoom: v.pipe(v.number(), v.finite(), v.minValue(1)),
  fit: v.boolean(),
  presets: v.pipe(v.array(ManuscriptPresetSchema), v.readonly()),
});

const ManuscriptPreferencesV4Schema = readonlyObject({
  version: v.literal(4),
  composition: ManuscriptCompositionSettings.schema,
  zoom: v.pipe(v.number(), v.finite(), v.minValue(1)),
  fit: v.boolean(),
  presets: v.pipe(v.array(ManuscriptPresetSchema), v.readonly()),
});

const PageSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

export type AppState = v.InferOutput<typeof AppStateSchema>;
export type ManuscriptPreset = v.InferOutput<typeof ManuscriptPresetSchema>;
export type ManuscriptPreferences = v.InferOutput<typeof ManuscriptPreferencesSchema>;
export type ManuscriptNotation = ManuscriptPreferences["notation"];

export const DEFAULT_APP_STATE: AppState = { version: 1, selectedPath: null };
export const DEFAULT_MANUSCRIPT_PREFERENCES: ManuscriptPreferences = {
  version: 5,
  notation: "pixiv",
  composition: ManuscriptCompositionSettings.defaults,
  zoom: 100,
  fit: false,
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
    const current = v.safeParse(ManuscriptPreferencesSchema, readJson(PREFERENCES_KEY));
    if (current.success) return current.output;

    const v4 = v.safeParse(ManuscriptPreferencesV4Schema, readJson(LEGACY_PREFERENCES_V4_KEY));
    if (v4.success) return { ...v4.output, version: 5, notation: "pixiv" };

    const v3 = v.safeParse(ManuscriptPreferencesV3Schema, readJson(LEGACY_PREFERENCES_V3_KEY));
    if (!v3.success) return DEFAULT_MANUSCRIPT_PREFERENCES;

    return {
      version: 5,
      notation: "pixiv",
      composition: v3.output.composition,
      zoom: v3.output.zoom.kind === "fixed" ? v3.output.zoom.percent : 100,
      fit: v3.output.zoom.kind === "fit",
      presets: v3.output.presets,
    };
  } catch {
    return DEFAULT_MANUSCRIPT_PREFERENCES;
  }
}

export function saveManuscriptPreferences(preferences: ManuscriptPreferences): boolean {
  try {
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify(v.parse(ManuscriptPreferencesSchema, preferences)),
    );
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
