import {
  composeManuscript,
  createDefaultProofreadingRules,
  manuscriptGridComposer,
  parseManuscript,
  pixivParser,
  proofreadManuscript,
  success,
} from "@sushichan044/kg-core";
import type {
  GridComposedManuscript,
  ManuscriptCompositionSettings,
  ManuscriptDiagnostic,
  ManuscriptResult,
} from "@sushichan044/kg-core";
import type { ZoomMode } from "@sushichan044/kg-viewer";

import type { ManuscriptPreferences, ManuscriptPreset } from "./lib/storage";

export interface ManuscriptState {
  readonly source: string;
  readonly preferences: ManuscriptPreferences;
  readonly activeDiagnosticId: string | null;
}

export type ManuscriptAction =
  | { readonly type: "document.replace"; readonly text: string }
  | {
      readonly type: "composition.replace";
      readonly composition: ManuscriptCompositionSettings;
    }
  | { readonly type: "zoom.replace"; readonly zoom: ZoomMode }
  | { readonly type: "preset.apply"; readonly preset: ManuscriptPreset }
  | { readonly type: "preset.save"; readonly preset: ManuscriptPreset }
  | { readonly type: "preset.delete"; readonly name: string }
  | { readonly type: "diagnostic.select"; readonly id: string | null };

export function manuscriptReducer(
  state: ManuscriptState,
  action: ManuscriptAction,
): ManuscriptState {
  switch (action.type) {
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
      return { ...state, preferences: { ...state.preferences, zoom: action.zoom } };
    }
    case "preset.apply": {
      return {
        ...state,
        preferences: { ...state.preferences, composition: action.preset.composition },
        activeDiagnosticId: null,
      };
    }
    case "preset.save": {
      const presets = state.preferences.presets.filter(({ name }) => name !== action.preset.name);
      return {
        ...state,
        preferences: { ...state.preferences, presets: [...presets, action.preset] },
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
  }
}

export interface ProcessedManuscript {
  readonly composed: GridComposedManuscript;
  readonly diagnostics: readonly ManuscriptDiagnostic[];
}

export function processManuscript(
  source: string,
  composition: ManuscriptCompositionSettings,
): ManuscriptResult<ProcessedManuscript> {
  const parsed = parseManuscript(source, { parser: pixivParser });
  if (!parsed.ok) return parsed;

  const composed = composeManuscript(parsed.value, {
    composer: manuscriptGridComposer,
    settings: composition,
  });
  if (!composed.ok) return composed;

  const rules = createDefaultProofreadingRules();
  if (!rules.ok) return rules;
  const proofread = proofreadManuscript(composed.value, { rules: rules.value });
  if (!proofread.ok) return proofread;

  const diagnostics = [
    ...parsed.warnings,
    ...composed.warnings,
    ...proofread.warnings,
    ...proofread.value,
  ];
  return success({ composed: composed.value, diagnostics });
}
