import { ManuscriptResult } from "@sushichan044/kg-core";
import type { NovelComposedManuscript, NovelCompositionSettings } from "@sushichan044/kg-core";
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

import { fixedPitchFeatures, geneiFontFamily } from "./typography-profile";

export type TypographyLoadError = Readonly<{
  kind: "font-load" | "font-integrity" | "shaper-load";
}>;
export type ReadyTypography = Readonly<{
  fontFamily: string;
  composer: ManuscriptComposer<NovelCompositionSettings, NovelComposedManuscript["layout"]>;
  measurer: RunMeasurer;
  dispose: () => void;
}>;

const GENEI_SHA256 = "c27fb4039ac9fae19152716992b5b9d07558e24f6cccea7b0c1abd0109235166";
const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

/**
 * Load the original Regular font before creating the synchronous composer.
 */
export async function loadGenEiKoburiTypography({
  fontUrl = new URL("../assets/GenEiKoburiMin6-R.ttf", import.meta.url),
}: Readonly<{ fontUrl?: string | URL }> = {}): Promise<
  ManuscriptResult<ReadyTypography, TypographyLoadError>
> {
  let data: ArrayBuffer;
  let face: FontFace;
  try {
    const response = await fetch(fontUrl);
    if (!response.ok) return ManuscriptResult.fail({ kind: "font-load" });
    data = await response.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", data);
    const sha = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    if (sha !== GENEI_SHA256) return ManuscriptResult.fail({ kind: "font-integrity" });
    face = await new FontFace("KGGenEiKoburi61", data, { weight: "400", style: "normal" }).load();
  } catch {
    return ManuscriptResult.fail({ kind: "font-load" });
  }
  let hb: typeof HarfBuzz;
  try {
    hb = await import("harfbuzzjs");
  } catch {
    return ManuscriptResult.fail({ kind: "shaper-load" });
  }
  const hbFace = new hb.Face(new hb.Blob(data));
  const font = new hb.Font(hbFace);
  const buffer = new hb.Buffer();
  const features = ["kern", "liga"].map((tag) => new hb.Feature(tag, 1));
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
    fontFamily: geneiFontFamily,
    fontFeatureSettings: fixedPitchFeatures,
    fontKerning: "none",
    fontSynthesis: "weight style",
    letterSpacing: "0",
    wordSpacing: "0",
    textTransform: "none",
    textIndent: "0",
    fontSizeAdjust: "none",
    textRendering: "geometricPrecision",
  });
  document.fonts.add(face);
  await document.fonts.ready;
  document.body.append(probe);
  let disposed = false;
  const measurer: RunMeasurer = (request) => {
    if (disposed) throw new Error("Typography resource has been disposed");
    if (request.fontPreset !== "mincho") return logicalRunMeasurer(request);
    const key = JSON.stringify(request);
    const found = cache.get(key);
    if (found !== undefined) return found;
    let result: RunMeasurement;
    if (request.kind === "base" && request.presentation === "sideways") {
      buffer.reset();
      buffer.addText(request.text);
      buffer.guessSegmentProperties();
      buffer.setDirection(hb.Direction.LTR);
      buffer.setLanguage("en");
      buffer.setClusterLevel(hb.ClusterLevel.MONOTONE_GRAPHEMES);
      hb.shape(font, buffer, features);
      const infos = buffer.getGlyphInfos();
      const positions = buffer.getGlyphPositions();
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
        const advanceEm = ((advances.get(start) ?? 0) / hbFace.upem) * request.scale;
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
        advanceEm: [...segmenter.segment(request.text)].length * 0.5 * request.scale,
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
  return ManuscriptResult.succeed({
    fontFamily: geneiFontFamily,
    composer: createNovelComposer({ measurer }),
    measurer,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      probe.remove();
      document.fonts.delete(face);
      cache.clear();
      buffer.reset();
    },
  });
}

function nativeAdvance(request: MeasurementRequest, probe: HTMLElement): number {
  const bodyPx = (request.fontSizePt * 96) / 72;
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
