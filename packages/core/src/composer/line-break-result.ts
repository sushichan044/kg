import * as v from "valibot";

import { readonlyObject } from "../internal/schema";

const LineBreakResultSchema = v.variant("kind", [
  readonlyObject({ kind: v.literal("natural") }),
  readonlyObject({ kind: v.literal("shrunk") }),
  readonlyObject({ kind: v.literal("stretched") }),
  readonlyObject({ kind: v.literal("hanging") }),
  readonlyObject({ kind: v.literal("forced") }),
  readonlyObject({ kind: v.literal("paragraph-end") }),
]);

export type LineBreakResult = v.InferOutput<typeof LineBreakResultSchema>;

export const LineBreakResult = { schema: LineBreakResultSchema } as const;
