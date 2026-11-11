import * as v from "valibot";

import { FontPresetId } from "../appearance/font-preset-id";
import { FontSizeQ } from "../appearance/font-size-q";
import { readonlyObject } from "../internal/schema";
import { PresentationKind } from "./presentation-kind";

const context = {
  text: v.string(),
  style: v.optional(
    readonlyObject({
      weight: v.picklist([400, 700]),
      slant: v.picklist(["normal", "italic"]),
    }),
  ),
  fontPreset: FontPresetId.schema,
  fontSizeQ: FontSizeQ.schema,
  scale: v.pipe(v.number(), v.finite(), v.minValue(Number.MIN_VALUE)),
  writingMode: v.literal("vertical-rl"),
};

const MeasurementRequestSchema = v.variant("kind", [
  readonlyObject({ ...context, kind: v.literal("base"), presentation: PresentationKind.schema }),
  readonlyObject({
    ...context,
    kind: v.literal("ruby"),
    presentation: v.picklist(["mixed", "sideways"]),
  }),
]);

/**
 * 本文の全角を単位とする同期的な測定。倍率はプロバイダがちょうど1回だけ適用する。
 */
export type MeasurementRequest = v.InferOutput<typeof MeasurementRequestSchema>;

export const MeasurementRequest = { schema: MeasurementRequestSchema } as const;
