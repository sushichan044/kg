import * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { NamespacedId } from "../namespaced-id";

const DiagnosticOriginSchema = v.variant("kind", [
  readonlyObject({ kind: v.literal("parser"), id: NamespacedId.schema }),
  readonlyObject({ kind: v.literal("rule"), id: NamespacedId.schema }),
]);

/**
 * Which stage produced a diagnostic, so consumers can filter parser noise from rule findings.
 */
export type DiagnosticOrigin = v.InferOutput<typeof DiagnosticOriginSchema>;

export const DiagnosticOrigin = { schema: DiagnosticOriginSchema } as const;
