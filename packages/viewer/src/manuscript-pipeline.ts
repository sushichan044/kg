import {
  ComposeError,
  composeManuscript,
  kakuyomuParser,
  ManuscriptResult,
  ParseError,
  parseManuscript,
  pixivParser,
  prepareManuscriptForFont,
} from "@sushichan044/kg-core";
import type {
  FontPresetId,
  ManuscriptDiagnostic,
  NovelComposedManuscript,
  NovelCompositionSettings,
} from "@sushichan044/kg-core";
import type { ProofreadError } from "@sushichan044/kg-core/lint";
import { createDefaultProofreadingRules, proofreadManuscript } from "@sushichan044/kg-core/lint";
import { createNovelComposer, createShapedRunMeasurer } from "@sushichan044/kg-core/plugin";
import type { RunMeasurer } from "@sushichan044/kg-core/plugin";

import { loadFontFiles } from "./font-files";
import type { TypographyLoadError } from "./font-files";
import { createHarfBuzzShaper } from "./harfbuzz-shaper";

export type ManuscriptNotation = "kakuyomu" | "pixiv";

export type ManuscriptInput = Readonly<{
  source: string;
  notation: ManuscriptNotation;
  settings: NovelCompositionSettings;
}>;

export type ProcessedManuscript = Readonly<{
  composed: NovelComposedManuscript;
  diagnostics: readonly ManuscriptDiagnostic[];
  proofreadFailure: ProofreadError | null;
}>;

export type ManuscriptFailure =
  | Readonly<{ stage: "parse"; error: ParseError }>
  | Readonly<{ stage: "compose"; error: ComposeError }>
  | Readonly<{ stage: "typography"; error: TypographyLoadError }>
  | Readonly<{ stage: "worker"; message: string }>;

export const ManuscriptFailure = {
  describe: (failure: ManuscriptFailure): string => {
    switch (failure.stage) {
      case "parse": {
        return ParseError.describe(failure.error);
      }
      case "compose": {
        return ComposeError.describe(failure.error);
      }
      case "typography": {
        return `書体を読み込めませんでした (${failure.error.kind})`;
      }
      case "worker": {
        return `組版ワーカーが失敗しました: ${failure.message}`;
      }
      default: {
        return failure satisfies never;
      }
    }
  },
} as const;

export type ManuscriptOutcome = ManuscriptResult<ProcessedManuscript, ManuscriptFailure>;

export type ManuscriptPipeline = Readonly<{
  process: (input: ManuscriptInput) => Promise<ManuscriptOutcome>;
  dispose: () => void;
}>;

type PresetRuntime = Readonly<{ measurer: RunMeasurer; dispose: () => void }>;

async function loadPresetRuntime(
  fontPreset: FontPresetId,
): Promise<ManuscriptResult<PresetRuntime, TypographyLoadError>> {
  const files = await loadFontFiles(fontPreset);
  if (!files.ok) return files;
  try {
    const shaper = await createHarfBuzzShaper(files.value);
    return ManuscriptResult.succeed({
      measurer: createShapedRunMeasurer(shaper),
      dispose: shaper.dispose,
    });
  } catch {
    return ManuscriptResult.fail({ kind: "shaper-load" });
  }
}

/**
 * Parse、prepare、compose、proofread を順に行う
 * DOM を使わないので、Worker でもメインスレッドでも同じものが動く
 */
export function createManuscriptPipeline(): ManuscriptPipeline {
  // 失敗した読み込みは残さず、次の要求で読み直す
  const runtimes = new Map<
    FontPresetId,
    Promise<ManuscriptResult<PresetRuntime, TypographyLoadError>>
  >();
  // ルールは関数を含み structured clone できないので、要求では受け取らずここで作る
  const rules = createDefaultProofreadingRules();

  const runtimeFor = (fontPreset: FontPresetId) => {
    const found = runtimes.get(fontPreset);
    if (found !== undefined) return found;
    const loading = loadPresetRuntime(fontPreset).then((result) => {
      if (!result.ok) runtimes.delete(fontPreset);
      return result;
    });
    runtimes.set(fontPreset, loading);
    return loading;
  };

  return {
    process: async ({ source, notation, settings }) => {
      const fontPreset = settings.appearance.fontPreset;
      const runtime = await runtimeFor(fontPreset);
      if (!runtime.ok) return ManuscriptResult.fail({ stage: "typography", error: runtime.error });

      const parsed = parseManuscript(source, {
        parser: notation === "pixiv" ? pixivParser : kakuyomuParser,
      });
      if (!parsed.ok) return ManuscriptResult.fail({ stage: "parse", error: parsed.error });

      const prepared = prepareManuscriptForFont(parsed.value, fontPreset);
      const composed = composeManuscript(prepared.parsed, {
        composer: createNovelComposer({ measurer: runtime.value.measurer }),
        settings,
      });
      if (!composed.ok) return ManuscriptResult.fail({ stage: "compose", error: composed.error });

      const proofread = proofreadManuscript(composed.value, { rules });
      return ManuscriptResult.succeed({
        composed: composed.value,
        diagnostics: [
          ...parsed.warnings.map((warning) =>
            Object.assign({}, warning, { range: prepared.mapRange(warning.range) }),
          ),
          ...composed.warnings,
          ...(proofread.ok ? [...proofread.warnings, ...proofread.value] : []),
        ],
        proofreadFailure: proofread.ok ? null : proofread.error,
      });
    },
    dispose: () => {
      for (const loading of runtimes.values())
        void loading.then((result) => {
          if (result.ok) result.value.dispose();
        });
      runtimes.clear();
    },
  };
}
