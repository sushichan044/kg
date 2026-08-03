import * as v from "valibot";

import {
  DEFAULT_APPEARANCE,
  DEFAULT_ZOOM,
  FONT_SIZE_PT_RANGE,
  fontPreset,
  paperSize,
} from "./appearance";
import type { ManuscriptAppearanceSettings, ManuscriptGeometry, ZoomMode } from "./appearance";
import { calculateManuscriptGeometry } from "./appearance";
import { plainTextNotation } from "./notation";
import type { ManuscriptNotation } from "./notation";
import {
  DEFAULT_OFFSETS,
  DEFAULT_SETTINGS,
  MAX_DOCUMENT_OFFSET,
  SETTING_RANGES,
  paginateManuscript,
} from "./pagination";
import type { GridSettings, ManuscriptOffsets, Pagination } from "./pagination";
import { DEFAULT_PROOFREADING_OPTIONS, proofreadManuscript } from "./proofreading";
import type { ManuscriptDiagnostic, ProofreadingOptions } from "./proofreading";

export interface ManuscriptPreset {
  name: string;
  settings: GridSettings;
  appearance: ManuscriptAppearanceSettings;
  offsets: ManuscriptOffsets;
}

export const DEFAULT_MANUSCRIPT_PRESET: ManuscriptPreset = {
  name: `${paperSize(DEFAULT_APPEARANCE.paperSize).label} / ${DEFAULT_APPEARANCE.fontSizePt}pt / ${fontPreset(DEFAULT_APPEARANCE.fontPreset).label} / ${DEFAULT_SETTINGS.charsPerLine}字 × ${DEFAULT_SETTINGS.linesPerStage}行 × ${DEFAULT_SETTINGS.stagesPerPage}段`,
  settings: DEFAULT_SETTINGS,
  appearance: DEFAULT_APPEARANCE,
  offsets: DEFAULT_OFFSETS,
};

export interface ManuscriptPreferences {
  settings: GridSettings;
  appearance: ManuscriptAppearanceSettings;
  offsets: ManuscriptOffsets;
  proofreading: ProofreadingOptions;
  zoom: ZoomMode;
  presets: ManuscriptPreset[];
}

export interface ManuscriptStateOptions extends Partial<ManuscriptPreferences> {
  text?: string;
  activeDiagnosticId?: string | null;
  notation?: ManuscriptNotation;
}

export interface ManuscriptConfigPatch {
  settings?: Partial<GridSettings>;
  appearance?: Partial<ManuscriptAppearanceSettings>;
  offsets?: {
    document?: Partial<ManuscriptOffsets["document"]>;
    page?: Partial<ManuscriptOffsets["page"]>;
    stage?: Partial<ManuscriptOffsets["stage"]>;
  };
  proofreading?: Partial<ProofreadingOptions>;
}

export type ManuscriptAction =
  | { type: "document.replace"; text: string }
  | { type: "config.patch"; patch: ManuscriptConfigPatch }
  | { type: "zoom.set"; zoom: ZoomMode }
  | { type: "diagnostic.select"; id: string | null }
  | { type: "preset.apply"; name: string }
  | { type: "preset.save"; name: string; overwrite: boolean }
  | { type: "preset.delete"; name: string };

export type ManuscriptIssueCode =
  | "diagnostic-not-found"
  | "invalid-config"
  | "invalid-preset-name"
  | "preset-exists"
  | "preset-not-found"
  | "preset-readonly"
  | "stale-transaction";

export interface ManuscriptIssue {
  code: ManuscriptIssueCode;
  message: string;
}

export interface ManuscriptTransaction {
  readonly previousState: ManuscriptState;
  readonly state: ManuscriptState;
  readonly actions: readonly ManuscriptAction[];
  readonly accepted: boolean;
  readonly issues: readonly ManuscriptIssue[];
  readonly documentChanged: boolean;
  readonly configChanged: boolean;
  readonly preferencesChanged: boolean;
  readonly selectionChanged: boolean;
}

export type ManuscriptListener = (transaction: ManuscriptTransaction) => void;

function copySettings(settings: GridSettings): GridSettings {
  return { ...settings };
}

function copyAppearance(appearance: ManuscriptAppearanceSettings): ManuscriptAppearanceSettings {
  return { ...appearance };
}

function copyOffsets(offsets: ManuscriptOffsets): ManuscriptOffsets {
  return {
    document: { ...offsets.document },
    page: { ...offsets.page },
    stage: { ...offsets.stage },
  };
}

function copyProofreading(proofreading: ProofreadingOptions): ProofreadingOptions {
  return { ...proofreading };
}

function copyPreset(preset: ManuscriptPreset): ManuscriptPreset {
  return {
    name: preset.name,
    settings: copySettings(preset.settings),
    appearance: copyAppearance(preset.appearance),
    offsets: copyOffsets(preset.offsets),
  };
}

const integer = (min: number, max = Number.POSITIVE_INFINITY) =>
  v.pipe(v.number(), v.finite(), v.integer(), v.minValue(min), v.maxValue(max));

export const GridSettingsSchema = v.object({
  charsPerLine: integer(SETTING_RANGES.charsPerLine.min, SETTING_RANGES.charsPerLine.max),
  linesPerStage: integer(SETTING_RANGES.linesPerStage.min, SETTING_RANGES.linesPerStage.max),
  stagesPerPage: integer(SETTING_RANGES.stagesPerPage.min, SETTING_RANGES.stagesPerPage.max),
});

export const ManuscriptAppearanceSchema = v.object({
  paperSize: v.picklist(["a4", "a5", "a6", "jis-b5", "jis-b6", "shinsho"]),
  fontSizePt: v.pipe(
    v.number(),
    v.finite(),
    v.minValue(FONT_SIZE_PT_RANGE.min),
    v.maxValue(FONT_SIZE_PT_RANGE.max),
    v.multipleOf(FONT_SIZE_PT_RANGE.step),
  ),
  fontPreset: v.picklist(["mincho", "gothic"]),
});

const documentLineOffsetSchema = v.object({
  leading: integer(0, MAX_DOCUMENT_OFFSET),
  trailing: integer(0, MAX_DOCUMENT_OFFSET),
});
const lineOffsetSchema = v.object({ leading: integer(0), trailing: integer(0) });

export const ManuscriptOffsetsSchema = v.object({
  document: documentLineOffsetSchema,
  page: lineOffsetSchema,
  stage: lineOffsetSchema,
});

export const ProofreadingOptionsSchema = v.object({
  paragraphLeadingCharacters: v.union([v.string(), v.literal(false)]),
  noPunctuationBeforeClosingQuote: v.boolean(),
  spaceAfterQuestionOrExclamation: v.boolean(),
  evenEllipsis: v.boolean(),
  evenDash: v.boolean(),
  noConsecutivePunctuation: v.boolean(),
  noConsecutiveInterpunct: v.boolean(),
  noConsecutiveChoonpu: v.boolean(),
  minusBeforeNumber: v.boolean(),
  maxArabicNumeralDigits: v.union([integer(1), v.literal(false)]),
  noVariantCharacters: v.boolean(),
});

export const ZoomModeSchema = v.variant("mode", [
  v.object({ mode: v.literal("fit") }),
  v.object({ mode: v.literal("fixed"), percent: v.picklist([50, 75, 100, 125, 150]) }),
]);

const manuscriptPresetSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  settings: GridSettingsSchema,
  appearance: ManuscriptAppearanceSchema,
  offsets: ManuscriptOffsetsSchema,
});

export const PersistedManuscriptPreferencesSchema = v.object({
  version: v.literal(2),
  settings: GridSettingsSchema,
  appearance: ManuscriptAppearanceSchema,
  offsets: ManuscriptOffsetsSchema,
  proofreading: ProofreadingOptionsSchema,
  zoom: ZoomModeSchema,
  presets: v.array(manuscriptPresetSchema),
});

const manuscriptConfigSchema = v.object({
  settings: GridSettingsSchema,
  appearance: ManuscriptAppearanceSchema,
  offsets: ManuscriptOffsetsSchema,
  proofreading: ProofreadingOptionsSchema,
});

function parsed<TOutput>(
  schema: v.GenericSchema<unknown, TOutput>,
  value: unknown,
): TOutput | null {
  const result = v.safeParse(schema, value);

  return result.success ? result.output : null;
}

export function parseGridSetting(field: keyof GridSettings, raw: string): number | null {
  if (raw.trim() === "") return null;
  const range = SETTING_RANGES[field];

  return parsed(integer(range.min, range.max), Number(raw));
}

export function parseFontSizePt(raw: string): number | null {
  if (raw.trim() === "") return null;

  return parsed(ManuscriptAppearanceSchema.entries.fontSizePt, Number(raw));
}

export function parseLineOffset(raw: string, documentScope = false): number | null {
  if (raw.trim() === "") return null;

  return parsed(integer(0, documentScope ? MAX_DOCUMENT_OFFSET : undefined), Number(raw));
}

function parseConfig(
  settings: GridSettings,
  appearance: ManuscriptAppearanceSettings,
  offsets: ManuscriptOffsets,
  proofreading: ProofreadingOptions,
): v.InferOutput<typeof manuscriptConfigSchema> | null {
  return parsed(manuscriptConfigSchema, { settings, appearance, offsets, proofreading });
}

function rejected(
  state: ManuscriptState,
  actions: readonly ManuscriptAction[],
  issue: ManuscriptIssue,
): ManuscriptTransaction {
  return {
    previousState: state,
    state,
    actions,
    accepted: false,
    issues: [issue],
    documentChanged: false,
    configChanged: false,
    preferencesChanged: false,
    selectionChanged: false,
  };
}

export class ManuscriptState {
  readonly text: string;
  readonly settings: GridSettings;
  readonly appearance: ManuscriptAppearanceSettings;
  readonly offsets: ManuscriptOffsets;
  readonly proofreading: ProofreadingOptions;
  readonly zoom: ZoomMode;
  readonly presets: readonly ManuscriptPreset[];
  readonly activeDiagnosticId: string | null;
  readonly notation: ManuscriptNotation;
  readonly pagination: Pagination;
  readonly geometry: ManuscriptGeometry;
  readonly diagnostics: readonly ManuscriptDiagnostic[];

  constructor(options: ManuscriptStateOptions = {}) {
    this.text = options.text ?? "";
    const config = parseConfig(
      options.settings ?? DEFAULT_SETTINGS,
      options.appearance ?? DEFAULT_APPEARANCE,
      options.offsets ?? DEFAULT_OFFSETS,
      options.proofreading ?? DEFAULT_PROOFREADING_OPTIONS,
    );
    const zoom = parsed(ZoomModeSchema, options.zoom ?? DEFAULT_ZOOM);
    const presets = parsed(v.array(manuscriptPresetSchema), options.presets ?? []);
    if (config === null || zoom === null || presets === null) {
      throw new TypeError("invalid manuscript configuration");
    }
    this.settings = copySettings(config.settings);
    this.appearance = copyAppearance(config.appearance);
    this.offsets = copyOffsets(config.offsets);
    this.proofreading = copyProofreading(config.proofreading);
    this.zoom = zoom;
    this.presets = presets;
    this.notation = options.notation ?? plainTextNotation;
    this.pagination = paginateManuscript(this.text, this.settings, this.offsets, this.notation);
    this.geometry = calculateManuscriptGeometry(this.settings, this.appearance);
    this.diagnostics = proofreadManuscript(this.text, this.proofreading, this.notation);
    this.activeDiagnosticId = this.diagnostics.some(({ id }) => id === options.activeDiagnosticId)
      ? (options.activeDiagnosticId ?? null)
      : null;
  }

  update(...actions: ManuscriptAction[]): ManuscriptTransaction {
    let text = this.text;
    const settings = copySettings(this.settings);
    const appearance = copyAppearance(this.appearance);
    const offsets = copyOffsets(this.offsets);
    const proofreading = copyProofreading(this.proofreading);
    let zoom = this.zoom;
    let presets = [...this.presets];
    let requestedDiagnosticId = this.activeDiagnosticId;

    for (const action of actions) {
      switch (action.type) {
        case "document.replace": {
          text = action.text;
          break;
        }
        case "config.patch": {
          Object.assign(settings, action.patch.settings);
          Object.assign(appearance, action.patch.appearance);
          Object.assign(offsets.document, action.patch.offsets?.document);
          Object.assign(offsets.page, action.patch.offsets?.page);
          Object.assign(offsets.stage, action.patch.offsets?.stage);
          Object.assign(proofreading, action.patch.proofreading);
          const config = parseConfig(settings, appearance, offsets, proofreading);
          if (config === null) {
            return rejected(this, actions, {
              code: "invalid-config",
              message: "invalid manuscript configuration",
            });
          }
          Object.assign(settings, config.settings);
          Object.assign(appearance, config.appearance);
          Object.assign(offsets.document, config.offsets.document);
          Object.assign(offsets.page, config.offsets.page);
          Object.assign(offsets.stage, config.offsets.stage);
          Object.assign(proofreading, config.proofreading);
          break;
        }
        case "zoom.set": {
          const nextZoom = parsed(ZoomModeSchema, action.zoom);
          if (nextZoom === null) {
            return rejected(this, actions, { code: "invalid-config", message: "invalid zoom" });
          }
          zoom = nextZoom;
          break;
        }
        case "diagnostic.select": {
          requestedDiagnosticId = action.id;
          break;
        }
        case "preset.apply": {
          const preset =
            action.name === DEFAULT_MANUSCRIPT_PRESET.name
              ? DEFAULT_MANUSCRIPT_PRESET
              : presets.find(({ name }) => name === action.name);
          if (preset === undefined) {
            return rejected(this, actions, {
              code: "preset-not-found",
              message: "preset not found",
            });
          }
          Object.assign(settings, preset.settings);
          Object.assign(appearance, preset.appearance);
          Object.assign(offsets.document, preset.offsets.document);
          Object.assign(offsets.page, preset.offsets.page);
          Object.assign(offsets.stage, preset.offsets.stage);
          break;
        }
        case "preset.save": {
          const name = action.name.trim();
          if (name === "") {
            return rejected(this, actions, {
              code: "invalid-preset-name",
              message: "preset name is empty",
            });
          }
          if (name === DEFAULT_MANUSCRIPT_PRESET.name) {
            return rejected(this, actions, {
              code: "preset-readonly",
              message: "built-in preset is read-only",
            });
          }
          const exists = presets.some((preset) => preset.name === name);
          if (exists && !action.overwrite) {
            return rejected(this, actions, {
              code: "preset-exists",
              message: "preset already exists",
            });
          }
          presets = [
            ...presets.filter((preset) => preset.name !== name),
            // Later actions in this batch keep mutating the loop-local config, so the
            // preset has to capture the values as they are at save time.
            {
              name,
              settings: copySettings(settings),
              appearance: copyAppearance(appearance),
              offsets: copyOffsets(offsets),
            },
          ];
          break;
        }
        case "preset.delete": {
          if (action.name === DEFAULT_MANUSCRIPT_PRESET.name) {
            return rejected(this, actions, {
              code: "preset-readonly",
              message: "built-in preset is read-only",
            });
          }
          if (!presets.some(({ name }) => name === action.name)) {
            return rejected(this, actions, {
              code: "preset-not-found",
              message: "preset not found",
            });
          }
          presets = presets.filter(({ name }) => name !== action.name);
          break;
        }
      }
    }

    const next = new ManuscriptState({
      text,
      settings,
      appearance,
      offsets,
      proofreading,
      zoom,
      presets,
      activeDiagnosticId: requestedDiagnosticId,
      notation: this.notation,
    });
    if (
      requestedDiagnosticId !== null &&
      !next.diagnostics.some(({ id }) => id === requestedDiagnosticId) &&
      actions.some(({ type }) => type === "diagnostic.select")
    ) {
      return rejected(this, actions, {
        code: "diagnostic-not-found",
        message: "diagnostic not found",
      });
    }

    const documentChanged = next.text !== this.text;
    const configChanged =
      JSON.stringify([next.settings, next.appearance, next.offsets, next.proofreading]) !==
      JSON.stringify([this.settings, this.appearance, this.offsets, this.proofreading]);
    const preferencesChanged =
      configChanged ||
      JSON.stringify(next.zoom) !== JSON.stringify(this.zoom) ||
      JSON.stringify(next.presets) !== JSON.stringify(this.presets);
    const selectionChanged = next.activeDiagnosticId !== this.activeDiagnosticId;
    const changed = documentChanged || preferencesChanged || selectionChanged;

    return {
      previousState: this,
      state: changed ? next : this,
      actions,
      accepted: true,
      issues: [],
      documentChanged,
      configChanged,
      preferencesChanged,
      selectionChanged,
    };
  }
}

export function createManuscriptState(options: ManuscriptStateOptions = {}): ManuscriptState {
  return new ManuscriptState(options);
}

export class ManuscriptController {
  #state: ManuscriptState;
  readonly #listeners = new Set<ManuscriptListener>();

  constructor(options: ManuscriptStateOptions = {}) {
    this.#state = createManuscriptState(options);
  }

  get state(): ManuscriptState {
    return this.#state;
  }

  dispatch(transaction: ManuscriptTransaction): ManuscriptTransaction;
  dispatch(...actions: ManuscriptAction[]): ManuscriptTransaction;
  dispatch(
    first: ManuscriptTransaction | ManuscriptAction,
    ...rest: ManuscriptAction[]
  ): ManuscriptTransaction {
    const transaction = "previousState" in first ? first : this.#state.update(first, ...rest);
    if (transaction.previousState !== this.#state) {
      return rejected(this.#state, transaction.actions, {
        code: "stale-transaction",
        message: "transaction does not start from the current state",
      });
    }
    if (!transaction.accepted || transaction.state === this.#state) {
      return transaction;
    }
    this.#state = transaction.state;
    for (const listener of this.#listeners) {
      listener(transaction);
    }

    return transaction;
  }

  subscribe(listener: ManuscriptListener): () => void {
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  }
}

export function createManuscript(options: ManuscriptStateOptions = {}): ManuscriptController {
  return new ManuscriptController(options);
}

export interface PersistedManuscriptPreferencesV2 {
  version: 2;
  settings: GridSettings;
  appearance: ManuscriptAppearanceSettings;
  offsets: ManuscriptOffsets;
  proofreading: ProofreadingOptions;
  zoom: ZoomMode;
  presets: ManuscriptPreset[];
}

export type DecodeManuscriptPreferencesResult =
  | { ok: true; value: ManuscriptPreferences }
  | { ok: false; issues: ManuscriptIssue[] };

export function encodeManuscriptPreferences(
  state: ManuscriptState,
): PersistedManuscriptPreferencesV2 {
  return {
    version: 2,
    settings: copySettings(state.settings),
    appearance: copyAppearance(state.appearance),
    offsets: copyOffsets(state.offsets),
    proofreading: copyProofreading(state.proofreading),
    zoom: state.zoom,
    presets: state.presets.map(copyPreset),
  };
}

export function decodeManuscriptPreferences(value: unknown): DecodeManuscriptPreferencesResult {
  const result = v.safeParse(PersistedManuscriptPreferencesSchema, value);
  if (!result.success) {
    return {
      ok: false,
      issues: [{ code: "invalid-config", message: "invalid manuscript preferences" }],
    };
  }
  const preferences = result.output;

  return {
    ok: true,
    value: {
      settings: copySettings(preferences.settings),
      appearance: copyAppearance(preferences.appearance),
      offsets: copyOffsets(preferences.offsets),
      proofreading: copyProofreading(preferences.proofreading),
      zoom: preferences.zoom,
      presets: preferences.presets.map(copyPreset),
    },
  };
}
