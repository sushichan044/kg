import { FontPreset, ManuscriptResult, prepareManuscriptForFont } from "@sushichan044/kg-core";
import type {
  FontPresetId,
  NovelComposedManuscript,
  NovelCompositionSettings,
  ParsedManuscript,
  PreparedFontManuscript,
} from "@sushichan044/kg-core";
import {
  createNovelComposer,
  GlyphOrientation,
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
import { readVerticalAdvances } from "./vertical-metrics";

/**
 * フォントのバイト列だけから測る測定器
 *
 * DOM に触れないので Node でも動く
 */
export type FontMeasurer = Readonly<{
  fontPreset: FontPresetId;
  prepare: (parsed: ParsedManuscript) => PreparedFontManuscript;
  composer: ManuscriptComposer<NovelCompositionSettings, NovelComposedManuscript["layout"]>;
  measurer: RunMeasurer;
}>;

export type FontMeasurerLoadError = Readonly<{
  kind: "font-load" | "font-integrity" | "shaper-load";
}>;

export type FontMeasurerFaces = Readonly<Partial<Record<400 | 700, ArrayBuffer | Uint8Array>>>;

export type CreateFontMeasurerOptions = Readonly<{
  fontPreset: FontPresetId;
  faces: FontMeasurerFaces;
}>;

export type LoadFontMeasurerOptions = Readonly<{
  fontPreset: FontPresetId;
  fontUrls?: Readonly<Partial<Record<400 | 700, string | URL>>>;
}>;

type ShapedFace = Readonly<{
  font: HarfBuzz.Font;
  upem: number;
}>;

const CACHE_LIMIT = 4096;
const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

async function sha256(data: ArrayBuffer | Uint8Array): Promise<string> {
  // SharedArrayBuffer に載ったビューは digest に渡せないので、ArrayBuffer に写す
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(data));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function shapeFace(hb: typeof HarfBuzz, data: ArrayBuffer | Uint8Array): ShapedFace {
  const face = new hb.Face(new hb.Blob(data));
  const parent = new hb.Font(face);
  // referenceTable は wasm のヒープを指し、ヒープが伸びると切り離されるので写しを持つ
  const verticalAdvance = readVerticalAdvances(
    face.referenceTable("vhea")?.slice(),
    face.referenceTable("vmtx")?.slice(),
  );
  if (verticalAdvance === undefined) return { font: parent, upem: face.upem };
  // harfbuzzjs は vmtx を読まず、すべてのグリフの縦の送り幅を 1 em とみなす
  // 子のフォントに縦の送り幅だけを差し替え、ほかの問い合わせは親に任せる
  const funcs = new hb.FontFuncs();
  funcs.setGlyphVAdvanceFunc((_, glyph) => -verticalAdvance(glyph));
  const font = parent.subFont();
  font.setFuncs(funcs);
  return { font, upem: face.upem };
}

function createMeasurer(
  hb: typeof HarfBuzz,
  fontPreset: FontPresetId,
  faces: ReadonlyMap<400 | 700, ShapedFace>,
): RunMeasurer {
  const profile = FontPreset.of(fontPreset);
  const [fallbackFace] = faces.values();
  const buffer = new hb.Buffer();
  const featuresOf = (kern: boolean) =>
    Object.entries({ ...profile.rendering.features, kern: kern ? 1 : 0 }).map(
      ([tag, value]) => new hb.Feature(tag, value),
    );
  const runFeatures = featuresOf(profile.rendering.westernKerning === "normal");
  // 1 書記素ずつ描く文字には、CSS で font-kerning: none を指定している
  const graphemeFeatures = featuresOf(false);
  const cache = new Map<string, RunMeasurement>();

  const shape = (
    shaped: ShapedFace,
    text: string,
    direction: "ltr" | "ttb",
    features: HarfBuzz.Feature[],
  ) => {
    buffer.reset();
    buffer.addText(text);
    buffer.guessSegmentProperties();
    buffer.setDirection(direction === "ttb" ? hb.Direction.TTB : hb.Direction.LTR);
    buffer.setLanguage(direction === "ttb" ? "ja" : "en");
    buffer.setClusterLevel(hb.ClusterLevel.MONOTONE_GRAPHEMES);
    hb.shape(shaped.font, buffer, features);
    return { infos: buffer.getGlyphInfos(), positions: buffer.getGlyphPositions() };
  };

  const covers = (shaped: ShapedFace, grapheme: string) =>
    Array.from(grapheme).every((character) => {
      const glyph = shaped.font.nominalGlyph(character.codePointAt(0) ?? 0);
      return glyph !== undefined && glyph !== 0;
    });

  const measureSideways = (shaped: ShapedFace, request: MeasurementRequest): RunMeasurement => {
    const { infos, positions } = shape(shaped, request.text, "ltr", runFeatures);
    const advances = new Map<number, number>();
    for (const [index, info] of infos.entries())
      advances.set(
        info.cluster,
        (advances.get(info.cluster) ?? 0) + (positions[index]?.xAdvance ?? 0),
      );
    const ends = [...new Set(infos.map(({ cluster }) => cluster)), request.text.length];
    const clusters: Array<Extract<RunMeasurement, { kind: "clustered" }>["clusters"][number]> = [];
    let offsetEm = 0;
    for (let index = 0; index < ends.length - 1; index += 1) {
      const start = ends[index];
      const end = ends[index + 1];
      if (start === undefined || end === undefined) continue;
      const advanceEm = ((advances.get(start) ?? 0) / shaped.upem) * request.scale;
      const span = { offsetEm, advanceEm };
      clusters.push({
        textRange: MeasurementTextRange.of({ start, end }),
        layoutSpan: span,
        renderSpan: span,
      });
      offsetEm += advanceEm;
    }
    return { kind: "clustered", advanceEm: offsetEm, clusters };
  };

  const measureGrapheme = (
    shaped: ShapedFace,
    request: MeasurementRequest,
    grapheme: string,
  ): number => {
    if (request.presentation === "tate-chu-yoko")
      throw new Error("tate-chu-yoko runs are not measured per grapheme");
    // ルビは CSS で text-orientation: upright として描くので、文字の種類によらず正立で測る
    const presentation = request.kind === "ruby" ? "upright" : request.presentation;
    if (!covers(shaped, grapheme))
      return logicalRunMeasurer({ ...request, kind: "base", presentation, text: grapheme })
        .advanceEm;
    const orientation = GlyphOrientation.of(grapheme, presentation);
    const direction = orientation === "upright" ? "ttb" : "ltr";
    const { positions } = shape(shaped, grapheme, direction, graphemeFeatures);
    const advance = positions.reduce(
      (total, { xAdvance, yAdvance }) => total + (direction === "ttb" ? -yAdvance : xAdvance),
      0,
    );
    return (advance / shaped.upem) * request.scale;
  };

  return (request) => {
    if (request.fontPreset !== fontPreset)
      throw new Error("Typography font does not match the composition settings");
    const key = JSON.stringify(request);
    const found = cache.get(key);
    if (found !== undefined) return found;
    const shaped = faces.get(request.style?.weight ?? 400) ?? fallbackFace;
    if (shaped === undefined) throw new Error("Typography has no font face");
    let result: RunMeasurement;
    if (request.kind === "base" && request.presentation === "sideways") {
      result = measureSideways(shaped, request);
    } else if (request.kind === "base" && request.presentation === "tate-chu-yoko") {
      // text-combine-upright は、長さにかかわらず連なり全体を全角 1 字分に収めて描く
      result = { kind: "advance", advanceEm: request.scale };
    } else {
      let advanceEm = 0;
      for (const { segment } of segmenter.segment(request.text))
        advanceEm += measureGrapheme(shaped, request, segment);
      result = { kind: "advance", advanceEm };
    }
    if (cache.size >= CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, result);
    return result;
  };
}

/**
 * 与えられたフォントのバイト列から測定器を作る
 *
 * バイト列は同梱のフォントと SHA-256 が一致しなければならない
 */
export async function createFontMeasurer({
  fontPreset,
  faces,
}: CreateFontMeasurerOptions): Promise<ManuscriptResult<FontMeasurer, FontMeasurerLoadError>> {
  if (FontPreset.of(fontPreset).measurement === "logical")
    return ManuscriptResult.succeed(logicalFontMeasurer(fontPreset));
  const shaper = loadShaper();
  const assets = typographyFonts[fontPreset];
  const verified = await Promise.all(
    assets.map(async (asset) => {
      const data = faces[asset.weight];
      if (data === undefined) return "font-load" as const;
      return (await sha256(data)) === asset.sha256 ? undefined : ("font-integrity" as const);
    }),
  );
  const failure = verified.find((kind) => kind !== undefined);
  if (failure !== undefined) return ManuscriptResult.fail({ kind: failure });
  const loaded = await shaper;
  if (!loaded.ok) return loaded;
  return ManuscriptResult.succeed(fontMeasurerFromVerifiedFaces(loaded.value, fontPreset, faces));
}

/**
 * フォントを読まずに測る測定器を作る
 *
 * 論理的な測定のプリセットに使う
 */
export function logicalFontMeasurer(fontPreset: FontPresetId): FontMeasurer {
  const measurer: RunMeasurer = (request) => {
    if (request.fontPreset !== fontPreset)
      throw new Error("Typography font does not match the composition settings");
    return logicalRunMeasurer(request);
  };
  return {
    fontPreset,
    prepare: (parsed: ParsedManuscript) => prepareManuscriptForFont(parsed, fontPreset),
    composer: createNovelComposer({ measurer }),
    measurer,
  };
}

function loadShaper(): Promise<ManuscriptResult<typeof HarfBuzz, FontMeasurerLoadError>> {
  return import("harfbuzzjs").then(
    (module): ManuscriptResult<typeof HarfBuzz, FontMeasurerLoadError> =>
      ManuscriptResult.succeed(module),
    (): ManuscriptResult<typeof HarfBuzz, FontMeasurerLoadError> =>
      ManuscriptResult.fail({ kind: "shaper-load" }),
  );
}

function fontMeasurerFromVerifiedFaces(
  hb: typeof HarfBuzz,
  fontPreset: FontPresetId,
  faces: FontMeasurerFaces,
): FontMeasurer {
  const shapedFaces = new Map<400 | 700, ShapedFace>();
  for (const asset of typographyFonts[fontPreset]) {
    const data = faces[asset.weight];
    if (data !== undefined) shapedFaces.set(asset.weight, shapeFace(hb, data));
  }
  const measurer = createMeasurer(hb, fontPreset, shapedFaces);
  return {
    fontPreset,
    prepare: (parsed) => prepareManuscriptForFont(parsed, fontPreset),
    composer: createNovelComposer({ measurer }),
    measurer,
  };
}

/**
 * 同梱のフォントを取得して測定器を作る
 */
export async function loadFontMeasurer({
  fontPreset,
  fontUrls,
}: LoadFontMeasurerOptions): Promise<ManuscriptResult<FontMeasurer, FontMeasurerLoadError>> {
  const fetched = await Promise.all(
    typographyFonts[fontPreset].map(async (asset) => {
      try {
        const response = await fetch(fontUrls?.[asset.weight] ?? asset.url);
        if (!response.ok) return undefined;
        return [asset.weight, await response.arrayBuffer()] as const;
      } catch {
        return undefined;
      }
    }),
  );
  if (fetched.includes(undefined)) return ManuscriptResult.fail({ kind: "font-load" });
  return createFontMeasurer({
    fontPreset,
    faces: Object.fromEntries(fetched.filter((entry) => entry !== undefined)),
  });
}
