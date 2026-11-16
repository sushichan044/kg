import { FontPreset, prepareManuscriptForFont, ManuscriptResult } from "@sushichan044/kg-core";
import type {
  FontPresetId,
  PreparedFontManuscript,
  ParsedManuscript,
  NovelComposedManuscript,
  NovelCompositionSettings,
} from "@sushichan044/kg-core";
import { createNovelComposer, createShapedRunMeasurer } from "@sushichan044/kg-core/plugin";
import type { ManuscriptComposer, RunMeasurer } from "@sushichan044/kg-core/plugin";

import { loadFontFiles } from "./font-files";
import type { FontFile, FontUrls, TypographyLoadError } from "./font-files";
import { createHarfBuzzShaper } from "./harfbuzz-shaper";
import type { HarfBuzzShaper } from "./harfbuzz-shaper";

export type { TypographyLoadError } from "./font-files";

type TypographyFontFace = Readonly<{
  family: string;
  src: string;
  weight: 400 | 700;
  style: "normal";
}>;

export type RenderTypography = Readonly<{
  fontFaces: readonly TypographyFontFace[];
  fontPreset: FontPresetId;
  fontFamily: string;
  dispose: () => void;
}>;

export type ReadyTypography = RenderTypography &
  Readonly<{
    prepare: (parsed: ParsedManuscript) => PreparedFontManuscript;
    composer: ManuscriptComposer<NovelCompositionSettings, NovelComposedManuscript["layout"]>;
    measurer: RunMeasurer;
  }>;

type TypographyOptions = Readonly<{
  fontPreset: FontPresetId;
  fontUrls?: FontUrls;
}>;

type RegisteredFonts = Readonly<{
  fontFaces: readonly TypographyFontFace[];
  dispose: () => void;
}>;

// FontFace の登録だけが document に触る
async function registerFonts(
  fontPreset: FontPresetId,
  files: readonly FontFile[],
): Promise<ManuscriptResult<RegisteredFonts, TypographyLoadError>> {
  const profile = FontPreset.of(fontPreset);
  let faces: FontFace[];
  try {
    faces = await Promise.all(
      files.map(({ weight, data }) =>
        new FontFace(profile.fontName, data, {
          weight: String(weight),
          style: "normal",
        }).load(),
      ),
    );
  } catch {
    return ManuscriptResult.fail({ kind: "font-load" });
  }
  for (const face of faces) document.fonts.add(face);
  const fontFaces = files.map(({ weight, data }): TypographyFontFace => ({
    family: profile.fontName,
    src: URL.createObjectURL(new Blob([data], { type: "font/ttf" })),
    weight,
    style: "normal",
  }));
  let disposed = false;
  return ManuscriptResult.succeed({
    fontFaces,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const face of faces) document.fonts.delete(face);
      for (const { src } of fontFaces) URL.revokeObjectURL(src);
    },
  });
}

export async function loadRenderTypography({
  fontPreset,
  fontUrls,
}: TypographyOptions): Promise<ManuscriptResult<RenderTypography, TypographyLoadError>> {
  const profile = FontPreset.of(fontPreset);
  const files = await loadFontFiles(fontPreset, fontUrls);
  if (!files.ok) return files;
  const registered = await registerFonts(fontPreset, files.value);
  if (!registered.ok) return registered;
  return ManuscriptResult.succeed({
    fontPreset,
    fontFaces: registered.value.fontFaces,
    fontFamily: profile.family,
    dispose: registered.value.dispose,
  });
}

/**
 * 宣言されたフェイスをすべて読み込んでから、それに対応する同期的なコンポーザーを公開する。
 */
export async function loadTypography({
  fontPreset,
  fontUrls,
}: TypographyOptions): Promise<ManuscriptResult<ReadyTypography, TypographyLoadError>> {
  const profile = FontPreset.of(fontPreset);
  const prepare = (parsed: ParsedManuscript) => prepareManuscriptForFont(parsed, fontPreset);
  let disposed = false;
  const guard =
    (measure: RunMeasurer): RunMeasurer =>
    (request) => {
      if (disposed) throw new Error("Typography resource has been disposed");
      if (request.fontPreset !== fontPreset)
        throw new Error("Typography font does not match the composition settings");
      return measure(request);
    };
  const files = await loadFontFiles(fontPreset, fontUrls);
  if (!files.ok) return files;
  let shaper: HarfBuzzShaper;
  try {
    shaper = await createHarfBuzzShaper(files.value);
  } catch {
    return ManuscriptResult.fail({ kind: "shaper-load" });
  }
  const registered = await registerFonts(fontPreset, files.value);
  if (!registered.ok) {
    shaper.dispose();
    return registered;
  }
  const measurer = guard(createShapedRunMeasurer(shaper));
  return ManuscriptResult.succeed({
    fontFaces: registered.value.fontFaces,
    fontPreset,
    prepare,
    fontFamily: profile.family,
    composer: createNovelComposer({ measurer }),
    measurer,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      shaper.dispose();
      registered.value.dispose();
    },
  });
}
