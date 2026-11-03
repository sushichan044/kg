import { NovelCompositionSettings } from "@sushichan044/kg-core";
import * as v from "valibot";

const APP_STATE_KEY = "kg.app.state.v1";
const PREFERENCES_KEY = "kg.manuscript.preferences.v7";
const PAGE_KEY_PREFIX = "kg.app.page.v1:";

const readonlyObject = <const TEntries extends v.ObjectEntries>(entries: TEntries) =>
  v.pipe(v.strictObject(entries), v.readonly());
const AppStateSchema = readonlyObject({
  version: v.literal(1),
  selectedPath: v.nullable(v.string()),
});

const ManuscriptPreferencesSchema = v.pipe(
  v.object({
    version: v.literal(7),
    notation: v.union([v.literal("pixiv"), v.literal("kakuyomu")]),
    composition: NovelCompositionSettings.schema,
    showGrid: v.boolean(),
    spread: v.optional(v.boolean(), false),
    startPageSide: v.optional(v.picklist(["left", "right"]), "right"),
    zoom: v.pipe(v.number(), v.finite(), v.minValue(1)),
    fit: v.boolean(),
  }),
  v.readonly(),
);

const PageSchema = v.pipe(v.number(), v.integer(), v.minValue(0));
const PreviousA5Schema = v.looseObject({
  composition: v.looseObject({
    appearance: v.looseObject({ paperSize: v.literal("a5") }),
    page: v.looseObject({ topMm: v.literal(12), bottomMm: v.literal(16.55) }),
  }),
});

export type AppState = v.InferOutput<typeof AppStateSchema>;
export type ManuscriptPreferences = v.InferOutput<typeof ManuscriptPreferencesSchema>;
export type ManuscriptNotation = ManuscriptPreferences["notation"];

export const DEFAULT_APP_STATE: AppState = { version: 1, selectedPath: null };
export const DEFAULT_MANUSCRIPT_PREFERENCES: ManuscriptPreferences = {
  version: 7,
  notation: "pixiv",
  composition: NovelCompositionSettings.defaults,
  showGrid: true,
  spread: false,
  startPageSide: "right",
  zoom: 100,
  fit: false,
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
    const stored = readJson(PREFERENCES_KEY);
    const previous = v.safeParse(PreviousA5Schema, stored);
    const migrated = previous.success
      ? {
          ...previous.output,
          composition: {
            ...previous.output.composition,
            page: { ...previous.output.composition.page, topMm: 16.55, bottomMm: 12 },
          },
        }
      : stored;
    const current = v.safeParse(ManuscriptPreferencesSchema, migrated);
    return current.success ? current.output : DEFAULT_MANUSCRIPT_PREFERENCES;
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
