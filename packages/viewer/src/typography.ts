import { FontPreset, prepareManuscriptForFont, ManuscriptResult } from "@sushichan044/kg-core";
import type {
  FontPresetId,
  PreparedFontManuscript,
  ParsedManuscript,
  NovelComposedManuscript,
  NovelCompositionSettings,
} from "@sushichan044/kg-core";
import {
  createNovelComposer,
  logicalRunMeasurer,
  MeasurementTextRange,
} from "@sushichan044/kg-core/plugin";
import type {
  ManuscriptComposer,
  MeasurementRequest,
  RunMeasurement,
  RunMeasurer,
} from "@sushichan044/kg-core/plugin";
import type * as HarfBuzz from "harfbuzzjs";

import { typographyFonts } from "./typography-fonts";
import { cssFontFeatures } from "./typography-profile";

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

const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

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
  let hb: typeof HarfBuzz;
  try {
    hb = await import("harfbuzzjs");
  } catch {
    return ManuscriptResult.fail({ kind: "shaper-load" });
  }
  let shapedFaces = loaded.map(({ weight, data }) => {
    const face = new hb.Face(new hb.Blob(data));
    return { weight, face, font: new hb.Font(face) };
  });
  let buffer: HarfBuzz.Buffer | undefined = new hb.Buffer();
  let features = Object.entries({
    ...profile.rendering.features,
    kern: profile.rendering.westernKerning === "normal" ? 1 : 0,
  }).map(([tag, value]) => new hb.Feature(tag, value));
  const cache = new Map<string, RunMeasurement>();
  const probe = document.createElement("span");
  probe.lang = "ja";
  Object.assign(probe.style, {
    position: "fixed",
    top: "0",
    left: "0",
    visibility: "hidden",
    pointerEvents: "none",
    display: "inline-block",
    whiteSpace: "pre",
    writingMode: "vertical-rl",
    lineHeight: "1",
    fontFamily: profile.family,
    fontFeatureSettings: cssFontFeatures(profile),
    fontKerning: "none",
    fontSynthesis: profile.rendering.synthesis,
    letterSpacing: "0",
    wordSpacing: "0",
    textTransform: "none",
    textIndent: "0",
    fontSizeAdjust: "none",
    textRendering: "geometricPrecision",
  });
  for (const { face } of loaded) document.fonts.add(face);
  await document.fonts.ready;
  document.body.append(probe);
  let disposed = false;
  const measurer: RunMeasurer = (request) => {
    if (disposed) throw new Error("Typography resource has been disposed");
    if (request.fontPreset !== fontPreset)
      throw new Error("Typography font does not match the composition settings");
    const key = JSON.stringify(request);
    const found = cache.get(key);
    if (found !== undefined) return found;
    const currentBuffer = buffer;
    if (currentBuffer === undefined) throw new Error("Typography resource has been disposed");
    let result: RunMeasurement;
    if (request.kind === "base" && request.presentation === "sideways") {
      const shaped =
        shapedFaces.find(({ weight }) => weight === (request.style?.weight ?? 400)) ??
        shapedFaces[0];
      if (shaped === undefined) throw new Error("Typography has no font face");
      currentBuffer.reset();
      currentBuffer.addText(request.text);
      currentBuffer.guessSegmentProperties();
      currentBuffer.setDirection(hb.Direction.LTR);
      currentBuffer.setLanguage("en");
      currentBuffer.setClusterLevel(hb.ClusterLevel.MONOTONE_GRAPHEMES);
      hb.shape(shaped.font, currentBuffer, features);
      const infos = currentBuffer.getGlyphInfos();
      const positions = currentBuffer.getGlyphPositions();
      const advances = new Map<number, number>();
      for (const [index, info] of infos.entries()) {
        advances.set(
          info.cluster,
          (advances.get(info.cluster) ?? 0) + (positions[index]?.xAdvance ?? 0),
        );
      }
      const ends = [...new Set(infos.map(({ cluster }) => cluster)), request.text.length];
      const clusters: Array<Extract<RunMeasurement, { kind: "clustered" }>["clusters"][number]> =
        [];
      let offsetEm = 0;
      for (let index = 0; index < ends.length - 1; index += 1) {
        const start = ends[index];
        const end = ends[index + 1];
        if (start === undefined || end === undefined) continue;
        const advanceEm = ((advances.get(start) ?? 0) / shaped.face.upem) * request.scale;
        const span = { offsetEm, advanceEm };
        clusters.push({
          textRange: MeasurementTextRange.of({ start, end }),
          layoutSpan: span,
          renderSpan: span,
        });
        offsetEm += advanceEm;
      }
      result = { kind: "clustered", advanceEm: offsetEm, clusters };
    } else if (request.kind === "base" && request.presentation === "tate-chu-yoko") {
      result = {
        kind: "advance",
        // text-combine-upright は、長さにかかわらず連なり全体を全角 1 字分に収めて描く。
        advanceEm: request.scale,
      };
    } else {
      result = { kind: "advance", advanceEm: nativeAdvance(request, probe) };
    }
    if (cache.size >= 4096) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, result);
    return result;
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
      probe.remove();
      for (const { face } of loaded) document.fonts.delete(face);
      loaded.length = 0;
      for (const { src } of fontFaces) URL.revokeObjectURL(src);
      cache.clear();
      shapedFaces = [];
      features = [];
      buffer = undefined;
    },
  });
}

function nativeAdvance(request: MeasurementRequest, probe: HTMLElement): number {
  const bodyPx = (request.fontSizeQ * 96) / 101.6;
  probe.style.fontSize = `${bodyPx * request.scale}px`;
  probe.style.fontWeight = String(request.style?.weight ?? 400);
  probe.style.fontStyle = request.style?.slant ?? "normal";
  probe.style.textOrientation =
    request.kind === "ruby" || request.presentation === "upright" ? "upright" : "mixed";
  let advanceEm = 0;
  for (const { segment } of segmenter.segment(request.text)) {
    probe.textContent = segment;
    advanceEm += probe.getBoundingClientRect().height / bodyPx;
  }
  return advanceEm;
}
