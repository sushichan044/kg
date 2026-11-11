import { FontPreset, prepareManuscriptForFont, ManuscriptResult } from "@sushichan044/kg-core";
import type {
  FontPresetId,
  PreparedFontManuscript,
  ParsedManuscript,
  NovelComposedManuscript,
  NovelCompositionSettings,
} from "@sushichan044/kg-core";
import { createNovelComposer, logicalRunMeasurer } from "@sushichan044/kg-core/plugin";
import type { ManuscriptComposer, RunMeasurer } from "@sushichan044/kg-core/plugin";

import { fontMeasurerFromVerifiedFaces, loadShaper } from "./font-measurer";
import { typographyFonts } from "./typography-fonts";

export type TypographyLoadError = Readonly<{
  kind: "font-load" | "font-integrity" | "shaper-load";
}>;
export type TypographyFontFace = Readonly<{
  family: string;
  src: string;
  weight: 400 | 700;
  style: "normal";
}>;

export type ReadyTypography = Readonly<{
  fontFaces: readonly TypographyFontFace[];
  fontPreset: FontPresetId;
  prepare: (parsed: ParsedManuscript) => PreparedFontManuscript;
  fontFamily: string;
  composer: ManuscriptComposer<NovelCompositionSettings, NovelComposedManuscript["layout"]>;
  measurer: RunMeasurer;
  dispose: () => void;
}>;

export type TypographyOptions = Readonly<{
  fontPreset: FontPresetId;
  fontUrls?: Readonly<Partial<Record<400 | 700, string | URL>>>;
}>;

/**
 * 宣言されたフェイスをすべて読み込んでから、それに対応する同期的なコンポーザーを公開する。
 */
export async function loadTypography({
  fontPreset,
  fontUrls,
}: TypographyOptions): Promise<ManuscriptResult<ReadyTypography, TypographyLoadError>> {
  const profile = FontPreset.of(fontPreset);
  const prepare = (parsed: ParsedManuscript) => prepareManuscriptForFont(parsed, fontPreset);
  if (profile.measurement === "logical") {
    let disposed = false;
    const measurer: RunMeasurer = (request) => {
      if (disposed) throw new Error("Typography resource has been disposed");
      if (request.fontPreset !== fontPreset)
        throw new Error("Typography font does not match the composition settings");
      return logicalRunMeasurer(request);
    };
    return ManuscriptResult.succeed({
      fontPreset,
      fontFaces: [],
      prepare,
      fontFamily: profile.family,
      composer: createNovelComposer({ measurer }),
      measurer,
      dispose: () => {
        disposed = true;
      },
    });
  }
  // フェイスの取得と並行して読み込む
  const shaper = loadShaper();
  const faces = await Promise.all(
    typographyFonts[fontPreset].map(
      async (
        asset,
      ): Promise<
        ManuscriptResult<
          Readonly<{ weight: 400 | 700; data: ArrayBuffer; face: FontFace }>,
          TypographyLoadError
        >
      > => {
        try {
          const response = await fetch(fontUrls?.[asset.weight] ?? asset.url);
          if (!response.ok) return ManuscriptResult.fail({ kind: "font-load" });
          const data = await response.arrayBuffer();
          const digest = await crypto.subtle.digest("SHA-256", data);
          const sha = Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join("");
          if (sha !== asset.sha256) return ManuscriptResult.fail({ kind: "font-integrity" });
          const face = await new FontFace(profile.fontName, data, {
            weight: String(asset.weight),
            style: "normal",
          }).load();
          return ManuscriptResult.succeed({ weight: asset.weight, data, face });
        } catch {
          return ManuscriptResult.fail({ kind: "font-load" });
        }
      },
    ),
  );
  const loaded: Array<Readonly<{ weight: 400 | 700; data: ArrayBuffer; face: FontFace }>> = [];
  for (const result of faces) {
    if (!result.ok) return result;
    loaded.push(result.value);
  }
  const loadedShaper = await shaper;
  if (!loadedShaper.ok) return loadedShaper;
  const measured = fontMeasurerFromVerifiedFaces(
    loadedShaper.value,
    fontPreset,
    Object.fromEntries(loaded.map(({ weight, data }) => [weight, data])),
  );
  for (const { face } of loaded) document.fonts.add(face);
  let disposed = false;
  const measurer: RunMeasurer = (request) => {
    if (disposed) throw new Error("Typography resource has been disposed");
    return measured.measurer(request);
  };
  const fontFaces = loaded.map(({ weight, data }): TypographyFontFace => ({
    family: profile.fontName,
    src: URL.createObjectURL(new Blob([data], { type: "font/ttf" })),
    weight,
    style: "normal",
  }));
  return ManuscriptResult.succeed({
    fontFaces,
    fontPreset,
    prepare,
    fontFamily: profile.family,
    composer: createNovelComposer({ measurer }),
    measurer,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const { face } of loaded) document.fonts.delete(face);
      loaded.length = 0;
      for (const { src } of fontFaces) URL.revokeObjectURL(src);
    },
  });
}
