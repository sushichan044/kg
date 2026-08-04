import {
  assertNever,
  ComposeError,
  composeManuscript,
  createDefaultProofreadingRules,
  manuscriptGridComposer,
  ManuscriptResult,
  ParseError,
  parseManuscript,
  pixivParser,
  ProofreadError,
  proofreadManuscript,
} from "@sushichan044/kg-core";
import type {
  GridComposedManuscript,
  ManuscriptCompositionSettings,
  ManuscriptDiagnostic,
} from "@sushichan044/kg-core";

import type { ManuscriptPreferences, ManuscriptPreset } from "./lib/storage";

export type ManuscriptState = Readonly<{
  source: string;
  preferences: ManuscriptPreferences;
  activeDiagnosticId: string | null;
}>;

export type ManuscriptAction =
  | Readonly<{ kind: "document.replace"; text: string }>
  | Readonly<{ kind: "composition.replace"; composition: ManuscriptCompositionSettings }>
  | Readonly<{ kind: "zoom.replace"; zoom: number; fit: boolean }>
  | Readonly<{ kind: "preset.apply"; preset: ManuscriptPreset }>
  | Readonly<{ kind: "preset.save"; preset: ManuscriptPreset }>
  | Readonly<{ kind: "preset.delete"; name: string }>
  | Readonly<{ kind: "diagnostic.select"; id: string | null }>;

export function manuscriptReducer(
  state: ManuscriptState,
  action: ManuscriptAction,
): ManuscriptState {
  switch (action.kind) {
    case "document.replace": {
      return { ...state, source: action.text, activeDiagnosticId: null };
    }
    case "composition.replace": {
      return {
        ...state,
        preferences: { ...state.preferences, composition: action.composition },
        activeDiagnosticId: null,
      };
    }
    case "zoom.replace": {
      return {
        ...state,
        preferences: { ...state.preferences, zoom: action.zoom, fit: action.fit },
      };
    }
    case "preset.apply": {
      return {
        ...state,
        preferences: { ...state.preferences, composition: action.preset.composition },
        activeDiagnosticId: null,
      };
    }
    case "preset.save": {
      const kept = state.preferences.presets.filter(({ name }) => name !== action.preset.name);
      return {
        ...state,
        preferences: { ...state.preferences, presets: [...kept, action.preset] },
      };
    }
    case "preset.delete": {
      return {
        ...state,
        preferences: {
          ...state.preferences,
          presets: state.preferences.presets.filter(({ name }) => name !== action.name),
        },
      };
    }
    case "diagnostic.select": {
      return { ...state, activeDiagnosticId: action.id };
    }
    default: {
      return assertNever(action);
    }
  }
}

export type ProcessedManuscript = Readonly<{
  composed: GridComposedManuscript;
  diagnostics: readonly ManuscriptDiagnostic[];
}>;

/**
 * Which stage failed, wrapping that stage's own error. Tagging by stage keeps the three error
 * unions distinguishable, which a flat union of them would not.
 */
export type ProcessManuscriptError =
  | Readonly<{ stage: "parse"; error: ParseError }>
  | Readonly<{ stage: "compose"; error: ComposeError }>
  | Readonly<{ stage: "proofread"; error: ProofreadError }>;

export const ProcessManuscriptError = {
  describe: (failure: ProcessManuscriptError): string => {
    switch (failure.stage) {
      case "parse": {
        return ParseError.describe(failure.error);
      }
      case "compose": {
        return ComposeError.describe(failure.error);
      }
      case "proofread": {
        return ProofreadError.describe(failure.error);
      }
      default: {
        return assertNever(failure);
      }
    }
  },
} as const;

export function processManuscript(
  source: string,
  composition: ManuscriptCompositionSettings,
): ManuscriptResult<ProcessedManuscript, ProcessManuscriptError> {
  const parsed = parseManuscript(source, { parser: pixivParser });
  if (!parsed.ok) return ManuscriptResult.fail({ stage: "parse", error: parsed.error });

  const composed = composeManuscript(parsed.value, {
    composer: manuscriptGridComposer,
    settings: composition,
  });
  if (!composed.ok) return ManuscriptResult.fail({ stage: "compose", error: composed.error });

  const proofread = proofreadManuscript(composed.value, {
    rules: createDefaultProofreadingRules(),
  });
  if (!proofread.ok) return ManuscriptResult.fail({ stage: "proofread", error: proofread.error });

  return ManuscriptResult.succeed({
    composed: composed.value,
    diagnostics: [
      ...parsed.warnings,
      ...composed.warnings,
      ...proofread.warnings,
      ...proofread.value,
    ],
  });
}
