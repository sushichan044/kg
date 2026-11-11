import * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { NamespacedId } from "../namespaced-id";

const DiagnosticOriginSchema = v.variant("kind", [
  readonlyObject({ kind: v.literal("parser"), id: NamespacedId.schema }),
  readonlyObject({ kind: v.literal("rule"), id: NamespacedId.schema }),
]);

/**
 * 診断を生成したステージ。利用側が、パーサー由来のノイズとルールの指摘とを区別できるようにする。
 */
export type DiagnosticOrigin = v.InferOutput<typeof DiagnosticOriginSchema>;

export const DiagnosticOrigin = { schema: DiagnosticOriginSchema } as const;
