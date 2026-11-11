import * as v from "valibot";

import { readonlyObject } from "../internal/schema";

const RejectionSchema = readonlyObject({ reason: v.string() });

/**
 * プラグインが結果の生成を断ったことを報告する方法。core はこれを、
 * そのステージ自身のエラー共用体の型付きバリアントに変換する。
 * そのため、プラグインが core のエラー型を組み立てる必要はない。
 */
export type Rejection = v.InferOutput<typeof RejectionSchema>;

export const Rejection = { schema: RejectionSchema } as const;
