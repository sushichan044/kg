import {
  ComposeError,
  composeManuscript,
  novelComposer,
  ManuscriptResult,
  ParseError,
  parseManuscript,
  prepareManuscriptForFont,
  kakuyomuParser,
  pixivParser,
} from "@sushichan044/kg-core";
import type {
  NovelComposedManuscript,
  NovelCompositionSettings,
  ManuscriptDiagnostic,
} from "@sushichan044/kg-core";
import { ProofreadError } from "@sushichan044/kg-core/lint";

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

/**
 * 組版まで終えた原稿。校正は別に（Worker で）行うので、ここに含まれる診断は
 * 解析と組版の警告だけである。
 */
export type ComposedSource = Readonly<{
  composed: NovelComposedManuscript;
  warnings: readonly ManuscriptDiagnostic[];
}>;

/**
 * どの段階が失敗したかを示し、その段階自身のエラーを包む。
 * 段階でタグ付けすると 3 つのエラーユニオンを区別できる。
 * 3 つを単純にまとめたユニオンでは区別できない。
 */
export type ProcessManuscriptError =
  | Readonly<{ stage: "parse"; error: ParseError }>
  | Readonly<{ stage: "compose"; error: ComposeError }>
  | Readonly<{ stage: "proofread"; error: ProofreadError }>;

export type ComposeSourceError = Exclude<ProcessManuscriptError, { stage: "proofread" }>;

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

/**
 * 解析と組版を同期で行う。組版は書体の計測にブラウザーの DOM を使うので、メインスレッドに残る。
 */
export function composeSource(
  source: string,
  composition: NovelCompositionSettings,
  notation: ManuscriptNotation,
  composer: typeof novelComposer = novelComposer,
): ManuscriptResult<ComposedSource, ComposeSourceError> {
  const parser = notation === "pixiv" ? pixivParser : kakuyomuParser;
  const parsed = parseManuscript(source, { parser });
  if (!parsed.ok) return ManuscriptResult.fail({ stage: "parse", error: parsed.error });

  const prepared = prepareManuscriptForFont(parsed.value, composition.appearance.fontPreset);
  const composed = composeManuscript(prepared.parsed, {
    composer,
    settings: composition,
  });
  if (!composed.ok) return ManuscriptResult.fail({ stage: "compose", error: composed.error });

  return ManuscriptResult.succeed({
    composed: composed.value,
    warnings: [
      ...parsed.warnings.map((warning) =>
        Object.assign({}, warning, { range: prepared.mapRange(warning.range) }),
      ),
      ...composed.warnings,
    ],
  });
}
