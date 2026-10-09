import type * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { InlineSpan } from "./inline-span";
import { MeasurementTextRange } from "./measurement-text-range";

const MeasuredClusterSchema = readonlyObject({
  textRange: MeasurementTextRange.schema,
  layoutSpan: InlineSpan.schema,
  renderSpan: InlineSpan.schema,
});

export type MeasuredCluster = v.InferOutput<typeof MeasuredClusterSchema>;

export const MeasuredCluster = { schema: MeasuredClusterSchema } as const;
