import type { FontPresetId } from "@sushichan044/kg-core";
import { GlyphOrientation } from "@sushichan044/kg-core/plugin";
import type { MeasurementRequest, RunMeasurer } from "@sushichan044/kg-core/plugin";
import * as v from "valibot";

import raw from "./measure-oracle.json";

const GraphemeSchema = v.union([
  v.object({ class: v.string(), missing: v.literal(true) }),
  v.object({ class: v.string(), upright: v.number(), sideways: v.number() }),
]);

const FaceSchema = v.object({
  file: v.string(),
  sha256: v.string(),
  upem: v.number(),
  graphemes: v.record(v.string(), GraphemeSchema),
  runs: v.record(v.string(), v.number()),
  verticalAdvances: v.record(v.string(), v.number()),
});

const OracleSchema = v.object({
  faces: v.object({
    "mincho-400": FaceSchema,
    "mincho-700": FaceSchema,
    "genei-koburi-400": FaceSchema,
  }),
});

export const measureOracle = v.parse(OracleSchema, raw);

export type OracleFaceId = keyof typeof measureOracle.faces;

export const ORACLE_FACES = [
  { id: "mincho-400", fontPreset: "mincho", weight: 400 },
  { id: "mincho-700", fontPreset: "mincho", weight: 700 },
  { id: "genei-koburi-400", fontPreset: "genei-koburi", weight: 400 },
] as const satisfies ReadonlyArray<
  Readonly<{ id: OracleFaceId; fontPreset: FontPresetId; weight: 400 | 700 }>
>;

export type OracleRow = Readonly<{
  face: OracleFaceId;
  label: string;
  className: string;
  expected: number;
  actual: number;
}>;

/**
 * フィクスチャの各値と、測定器が返す値を並べる
 *
 * フォントにない書記素は、欠落の方針を確かめるテストで扱う
 */
export function oracleRows(
  measurers: Readonly<Partial<Record<FontPresetId, RunMeasurer>>>,
): OracleRow[] {
  return ORACLE_FACES.flatMap(({ id, fontPreset, weight }) => {
    const face = measureOracle.faces[id];
    const measurer = measurers[fontPreset];
    if (measurer === undefined) return [];
    const style: MeasurementRequest["style"] =
      weight === 400 ? undefined : { weight, slant: "normal" };
    const context = {
      fontPreset,
      fontSizeQ: 12.7,
      writingMode: "vertical-rl",
      ...(style === undefined ? {} : { style }),
    } as const;
    const row = (
      request: MeasurementRequest,
      className: string,
      expectedUnits: number,
    ): OracleRow => ({
      face: id,
      label: `${request.kind} ${request.presentation} ${JSON.stringify(request.text)}`,
      className,
      expected: (expectedUnits / face.upem) * request.scale,
      actual: measurer(request).advanceEm,
    });
    const graphemes = Object.entries(face.graphemes).flatMap(([text, entry]) => {
      if ("missing" in entry) return [];
      const mixed = entry[GlyphOrientation.of(text, "mixed")];
      return [
        row(
          { ...context, text, kind: "base", presentation: "mixed", scale: 1 },
          entry.class,
          mixed,
        ),
        row(
          { ...context, text, kind: "base", presentation: "upright", scale: 1 },
          entry.class,
          entry.upright,
        ),
        row(
          { ...context, text, kind: "ruby", presentation: "mixed", scale: 0.5 },
          entry.class,
          entry.upright,
        ),
      ];
    });
    const runs = Object.entries(face.runs).map(([text, advance]) =>
      row(
        { ...context, text, kind: "base", presentation: "sideways", scale: 1 },
        "sideways-run",
        advance,
      ),
    );
    return graphemes.concat(runs);
  });
}
