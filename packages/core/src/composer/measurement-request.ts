import * as v from "valibot";

import { FontPresetId } from "../appearance/font-preset-id";
import { FontSizePt } from "../appearance/font-size-pt";
import { readonlyObject } from "../internal/schema";
import { PresentationKind } from "./presentation-kind";

const context = {
  text: v.string(),
  fontPreset: FontPresetId.schema,
  fontSizePt: FontSizePt.schema,
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
 * Synchronous measurement in body em; the provider applies scale exactly once.
 */
export type MeasurementRequest = v.InferOutput<typeof MeasurementRequestSchema>;

export const MeasurementRequest = { schema: MeasurementRequestSchema } as const;
