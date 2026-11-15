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
 * 同期に済ませる段階（parse と compose）の成果。
 * 校正の指摘は含まず、段階が回復した警告だけを持つ。
 */
export type ComposedSource = Readonly<{
  composed: NovelComposedManuscript;
  diagnostics: readonly ManuscriptDiagnostic[];
}>;

/**
 * Worker が校正を完了できなかったこと。ルール側の失敗は `ProofreadError` で表す。
 */
type ProofreadWorkerError = Readonly<{ kind: "WorkerFailed"; cause: unknown }>;

export type ProofreadFailure = ProofreadError | ProofreadWorkerError;

export const ProofreadFailure = {
  describe: (failure: ProofreadFailure): string =>
    failure.kind === "WorkerFailed"
      ? `校正ワーカーが失敗しました: ${describeUnknown(failure.cause)}`
      : ProofreadError.describe(failure),
} as const;

function describeUnknown(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

// 段階でタグ付けしないと、3 つのエラーユニオンを区別できない
export type ProcessManuscriptError =
  | Readonly<{ stage: "parse"; error: ParseError }>
  | Readonly<{ stage: "compose"; error: ComposeError }>;

export const ProcessManuscriptError = {
  describe: (failure: ProcessManuscriptError): string => {
    switch (failure.stage) {
      case "parse": {
        return ParseError.describe(failure.error);
      }
      case "compose": {
        return ComposeError.describe(failure.error);
      }
      default: {
        return assertNever(failure);
      }
    }
  },
} as const;

/**
 * Parse と compose だけを同期で行う。compose は書体の測定に DOM を使うのでメインスレッドに残す。
 * 校正は Worker で行い、結果は `useProofreading` が合流させる。
 */
export function composeSource(
  source: string,
  composition: NovelCompositionSettings,
  notation: ManuscriptNotation,
  composer: typeof novelComposer = novelComposer,
): ManuscriptResult<ComposedSource, ProcessManuscriptError> {
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
    diagnostics: [
      ...parsed.warnings.map((warning) =>
        Object.assign({}, warning, { range: prepared.mapRange(warning.range) }),
      ),
      ...composed.warnings,
    ],
  });
}
