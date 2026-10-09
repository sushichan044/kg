import * as v from "valibot";

import { readonlyArray, readonlyObject } from "../internal/schema";
import { graphemeSegmenter } from "../internal/segmenter";
import { MeasuredCluster } from "./measured-cluster";
import type { MeasurementRequest } from "./measurement-request";

const advanceEm = v.pipe(v.number(), v.finite(), v.minValue(0));
const RunMeasurementSchema = v.variant("kind", [
  readonlyObject({ kind: v.literal("advance"), advanceEm }),
  readonlyObject({
    kind: v.literal("clustered"),
    advanceEm,
    clusters: readonlyArray(MeasuredCluster.schema),
  }),
]);

export type RunMeasurement = v.InferOutput<typeof RunMeasurementSchema>;

export const RunMeasurement = {
  schema: RunMeasurementSchema,
  parseFor: (request: MeasurementRequest, raw: unknown): RunMeasurement | undefined => {
    const result = v.safeParse(RunMeasurementSchema, raw);
    if (!result.success) return undefined;
    const measurement = result.output;
    if (measurement.kind === "advance") return measurement;
    const boundaries = new Set(
      [...graphemeSegmenter.segment(request.text)].map(({ index }) => index),
    );
    boundaries.add(request.text.length);
    let textEnd = 0;
    let layoutEnd = 0;
    for (const cluster of measurement.clusters) {
      const { textRange, layoutSpan } = cluster;
      if (
        textRange.start !== textEnd ||
        textRange.end <= textRange.start ||
        !boundaries.has(textRange.start) ||
        !boundaries.has(textRange.end) ||
        Math.abs(layoutSpan.offsetEm - layoutEnd) > 1e-9
      )
        return undefined;
      textEnd = textRange.end;
      layoutEnd = layoutSpan.offsetEm + layoutSpan.advanceEm;
    }
    return textEnd === request.text.length && Math.abs(layoutEnd - measurement.advanceEm) <= 1e-9
      ? measurement
      : undefined;
  },
} as const;
