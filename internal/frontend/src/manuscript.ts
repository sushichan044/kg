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
import {
  createDefaultProofreadingRules,
  ProofreadError,
  proofreadManuscript,
} from "@sushichan044/kg-core/lint";

import { assertNever } from "./lib/assert-never";
import type { ManuscriptNotation, ManuscriptPreferences, ManuscriptPreset } from "./lib/storage";

export type PreferenceAction =
  | Readonly<{ kind: "composition.replace"; composition: NovelCompositionSettings }>
  | Readonly<{ kind: "grid-visibility.replace"; showGrid: boolean }>
  | Readonly<{ kind: "notation.replace"; notation: ManuscriptNotation }>
  | Readonly<{ kind: "zoom.replace"; zoom: number; fit: boolean }>
  | Readonly<{ kind: "preset.apply"; preset: ManuscriptPreset }>
  | Readonly<{ kind: "preset.save"; preset: ManuscriptPreset }>
  | Readonly<{ kind: "preset.delete"; name: string }>;

export function preferencesReducer(
  preferences: ManuscriptPreferences,
  action: PreferenceAction,
): ManuscriptPreferences {
  switch (action.kind) {
    case "composition.replace": {
      return { ...preferences, composition: action.composition };
    }
    case "notation.replace": {
      return { ...preferences, notation: action.notation };
    }
    case "grid-visibility.replace": {
      return { ...preferences, showGrid: action.showGrid };
    }
    case "zoom.replace": {
      return { ...preferences, zoom: action.zoom, fit: action.fit };
    }
    case "preset.apply": {
      return { ...preferences, composition: action.preset.composition };
    }
    case "preset.save": {
      const kept = preferences.presets.filter(({ name }) => name !== action.preset.name);
      return { ...preferences, presets: [...kept, action.preset] };
    }
    case "preset.delete": {
      return {
        ...preferences,
        presets: preferences.presets.filter(({ name }) => name !== action.name),
      };
    }
    default: {
      return assertNever(action);
    }
  }
}

export type ProcessedManuscript = Readonly<{
  composed: NovelComposedManuscript;
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
  composition: NovelCompositionSettings,
  notation: ManuscriptNotation,
  composer: typeof novelComposer = novelComposer,
): ManuscriptResult<ProcessedManuscript, ProcessManuscriptError> {
  const parser = notation === "pixiv" ? pixivParser : kakuyomuParser;
  const parsed = parseManuscript(source, { parser });
  if (!parsed.ok) return ManuscriptResult.fail({ stage: "parse", error: parsed.error });

  const prepared = prepareManuscriptForFont(parsed.value, composition.appearance.fontPreset);
  const composed = composeManuscript(prepared.parsed, {
    composer,
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
      ...parsed.warnings.map((warning) =>
        Object.assign({}, warning, { range: prepared.mapRange(warning.range) }),
      ),
      ...composed.warnings,
      ...proofread.warnings,
      ...proofread.value,
    ],
  });
}
