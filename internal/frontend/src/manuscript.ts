import type { NovelCompositionSettings } from "@sushichan044/kg-core";

import { assertNever } from "./lib/assert-never";
import type { ManuscriptNotation, ManuscriptPreferences } from "./lib/storage";

export type ManuscriptState = Readonly<{
  preferences: ManuscriptPreferences;
  activeDiagnosticId: string | null;
}>;

export type ManuscriptAction =
  | Readonly<{ kind: "composition.replace"; composition: NovelCompositionSettings }>
  | Readonly<{ kind: "grid-visibility.replace"; showGrid: boolean }>
  | Readonly<{ kind: "spread.replace"; spread: boolean }>
  | Readonly<{
      kind: "start-page-side.replace";
      startPageSide: ManuscriptPreferences["startPageSide"];
    }>
  | Readonly<{ kind: "notation.replace"; notation: ManuscriptNotation }>
  | Readonly<{ kind: "zoom.replace"; zoom: number; fit: boolean }>
  | Readonly<{ kind: "diagnostic.select"; id: string | null }>;

export function manuscriptReducer(
  state: ManuscriptState,
  action: ManuscriptAction,
): ManuscriptState {
  switch (action.kind) {
    case "composition.replace": {
      return {
        ...state,
        preferences: { ...state.preferences, composition: action.composition },
        activeDiagnosticId: null,
      };
    }
    case "notation.replace": {
      return {
        ...state,
        preferences: { ...state.preferences, notation: action.notation },
        activeDiagnosticId: null,
      };
    }
    case "grid-visibility.replace": {
      return {
        ...state,
        preferences: { ...state.preferences, showGrid: action.showGrid },
      };
    }
    case "spread.replace": {
      return { ...state, preferences: { ...state.preferences, spread: action.spread } };
    }
    case "start-page-side.replace": {
      return {
        ...state,
        preferences: { ...state.preferences, startPageSide: action.startPageSide },
      };
    }
    case "zoom.replace": {
      return {
        ...state,
        preferences: { ...state.preferences, zoom: action.zoom, fit: action.fit },
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
