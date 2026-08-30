import {
  ManuscriptAppearanceSettings,
  ManuscriptOffsets,
  NovelCompositionSettings,
} from "@sushichan044/kg-core";
import * as v from "valibot";

const APP_STATE_KEY = "kg.app.state.v1";
const PREFERENCES_KEY = "kg.manuscript.preferences.v6";
const LEGACY_PREFERENCES_V5_KEY = "kg.manuscript.preferences.v5";
const LEGACY_PREFERENCES_V4_KEY = "kg.manuscript.preferences.v4";
const LEGACY_PREFERENCES_V3_KEY = "kg.manuscript.preferences.v3";
const PAGE_KEY_PREFIX = "kg.app.page.v1:";

const readonlyObject = <const TEntries extends v.ObjectEntries>(entries: TEntries) =>
  v.pipe(v.strictObject(entries), v.readonly());
const boundedInteger = (min: number, max: number) =>
  v.pipe(v.number(), v.finite(), v.integer(), v.minValue(min), v.maxValue(max));

const AppStateSchema = readonlyObject({
  version: v.literal(1),
  selectedPath: v.nullable(v.string()),
});

const LegacyZoomModeSchema = v.variant("kind", [
  readonlyObject({ kind: v.literal("fit") }),
  readonlyObject({
    kind: v.literal("fixed"),
    percent: v.pipe(v.number(), v.finite(), v.minValue(1)),
  }),
]);

const LegacyCompositionSchema = v.pipe(
  readonlyObject({
    grid: readonlyObject({
      charsPerLine: boundedInteger(10, 60),
      linesPerStage: boundedInteger(10, 60),
      stagesPerPage: boundedInteger(1, 3),
    }),
    offsets: ManuscriptOffsets.schema,
    appearance: ManuscriptAppearanceSettings.schema,
  }),
  v.check(({ grid, offsets }) => {
    const stageOffset = offsets.stage.leading + offsets.stage.trailing;
    const pageOffset = offsets.page.leading + offsets.page.trailing;
    return (
      stageOffset < grid.linesPerStage &&
      pageOffset < (grid.linesPerStage - stageOffset) * grid.stagesPerPage
    );
  }),
);

type LegacyComposition = v.InferOutput<typeof LegacyCompositionSchema>;

const LegacyPresetSchema = readonlyObject({
  name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  composition: LegacyCompositionSchema,
});

const ManuscriptPresetSchema = readonlyObject({
  name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  composition: NovelCompositionSettings.schema,
});

const ManuscriptPreferencesV3Schema = readonlyObject({
  version: v.literal(3),
  composition: LegacyCompositionSchema,
  zoom: LegacyZoomModeSchema,
  presets: v.pipe(v.array(LegacyPresetSchema), v.readonly()),
});

const ManuscriptPreferencesV4Schema = readonlyObject({
  version: v.literal(4),
  composition: LegacyCompositionSchema,
  zoom: v.pipe(v.number(), v.finite(), v.minValue(1)),
  fit: v.boolean(),
  presets: v.pipe(v.array(LegacyPresetSchema), v.readonly()),
});

const ManuscriptPreferencesV5Schema = readonlyObject({
  version: v.literal(5),
  notation: v.union([v.literal("pixiv"), v.literal("kakuyomu")]),
  composition: LegacyCompositionSchema,
  zoom: v.pipe(v.number(), v.finite(), v.minValue(1)),
  fit: v.boolean(),
  presets: v.pipe(v.array(LegacyPresetSchema), v.readonly()),
});

const ManuscriptPreferencesSchema = readonlyObject({
  version: v.literal(6),
  notation: v.union([v.literal("pixiv"), v.literal("kakuyomu")]),
  composition: NovelCompositionSettings.schema,
  showGrid: v.boolean(),
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
  version: 6,
  notation: "pixiv",
  composition: NovelCompositionSettings.defaults,
  showGrid: true,
  zoom: 100,
  fit: false,
  presets: [],
};

function readJson(key: string): unknown {
  const raw = localStorage.getItem(key);
  return raw === null ? null : JSON.parse(raw);
}

function migrateComposition(composition: LegacyComposition): NovelCompositionSettings {
  return {
    flow: {
      lineLengthEm: composition.grid.charsPerLine,
      linesPerStage: composition.grid.linesPerStage,
      stagesPerPage: composition.grid.stagesPerPage,
    },
    offsets: composition.offsets,
    appearance: composition.appearance,
  };
}

function migratePresets(presets: ReadonlyArray<v.InferOutput<typeof LegacyPresetSchema>>) {
  return presets.map(({ name, composition }) => ({
    name,
    composition: migrateComposition(composition),
  }));
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

    const v5 = v.safeParse(ManuscriptPreferencesV5Schema, readJson(LEGACY_PREFERENCES_V5_KEY));
    if (v5.success) {
      return {
        ...v5.output,
        version: 6,
        composition: migrateComposition(v5.output.composition),
        showGrid: true,
        presets: migratePresets(v5.output.presets),
      };
    }

    const v4 = v.safeParse(ManuscriptPreferencesV4Schema, readJson(LEGACY_PREFERENCES_V4_KEY));
    if (v4.success) {
      return {
        ...v4.output,
        version: 6,
        notation: "pixiv",
        composition: migrateComposition(v4.output.composition),
        showGrid: true,
        presets: migratePresets(v4.output.presets),
      };
    }

    const v3 = v.safeParse(ManuscriptPreferencesV3Schema, readJson(LEGACY_PREFERENCES_V3_KEY));
    if (!v3.success) return DEFAULT_MANUSCRIPT_PREFERENCES;

    return {
      version: 6,
      notation: "pixiv",
      composition: migrateComposition(v3.output.composition),
      showGrid: true,
      zoom: v3.output.zoom.kind === "fixed" ? v3.output.zoom.percent : 100,
      fit: v3.output.zoom.kind === "fit",
      presets: migratePresets(v3.output.presets),
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
