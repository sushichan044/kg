import { graphemeSegmenter } from "../../internal/segmenter";
import type { NovelCompositionSettings } from "../composition-settings";
import type { MeasuredCluster } from "../measured-cluster";
import type { MeasurementRequest } from "../measurement-request";
import { MeasurementTextRange } from "../measurement-text-range";
import type { PresentationKind } from "../presentation-kind";
import { RunMeasurement } from "../run-measurement";
import type { RunMeasurer } from "../run-measurer";

export type MeasurementPiece = MeasuredCluster & Readonly<{ value: string }>;

export type MeasurementSession = Readonly<{
  get: (
    text: string,
    kind: "base" | "ruby",
    presentation?: PresentationKind,
  ) => RunMeasurement | undefined;
  pieces: (
    text: string,
    kind: "base" | "ruby",
    presentation?: PresentationKind,
  ) => readonly MeasurementPiece[] | undefined;
}>;

export const MeasurementSession = {
  create: (provider: RunMeasurer, settings: NovelCompositionSettings): MeasurementSession => {
    const cache = new Map<string, RunMeasurement | undefined>();
    const get: MeasurementSession["get"] = (text, kind, presentation = "mixed") => {
      const request: MeasurementRequest =
        kind === "base"
          ? {
              text,
              kind,
              presentation,
              fontPreset: settings.appearance.fontPreset,
              fontSizePt: settings.appearance.fontSizePt,
              scale: 1,
              writingMode: "vertical-rl",
            }
          : {
              text,
              kind,
              presentation: "mixed",
              fontPreset: settings.appearance.fontPreset,
              fontSizePt: settings.appearance.fontSizePt,
              scale: 0.5,
              writingMode: "vertical-rl",
            };
      const key = JSON.stringify(request);
      if (cache.has(key)) return cache.get(key);
      const measurement = RunMeasurement.parseFor(request, provider(request));
      cache.set(key, measurement);
      return measurement;
    };
    return {
      get,
      pieces: (text, kind, presentation) => {
        const full = get(text, kind, presentation);
        if (full === undefined) return undefined;
        if (full.kind === "clustered") {
          return full.clusters.map((cluster) => ({
            textRange: cluster.textRange,
            layoutSpan: cluster.layoutSpan,
            renderSpan: cluster.renderSpan,
            value: text.slice(cluster.textRange.start, cluster.textRange.end),
          }));
        }
        const pieces: MeasurementPiece[] = [];
        let offsetEm = 0;
        for (const { segment, index } of graphemeSegmenter.segment(text)) {
          const measured = get(segment, kind, presentation);
          if (measured === undefined) return undefined;
          const cluster = measured.kind === "clustered" ? measured.clusters[0] : undefined;
          pieces.push({
            value: segment,
            textRange: MeasurementTextRange.of({ start: index, end: index + segment.length }),
            layoutSpan: { offsetEm, advanceEm: measured.advanceEm },
            renderSpan: {
              offsetEm: offsetEm + (cluster?.renderSpan.offsetEm ?? 0),
              advanceEm: cluster?.renderSpan.advanceEm ?? measured.advanceEm,
            },
          });
          offsetEm += measured.advanceEm;
        }
        return pieces;
      },
    };
  },
} as const;
