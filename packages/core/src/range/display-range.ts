import * as v from "valibot";

import { TextRange } from "./text-range";

/**
 * 表示用テキストへの UTF-16 オフセット。サービス固有の記法を取り除いた後のテキストである。
 */
const DisplayRangeSchema = v.pipe(TextRange.schema, v.brand("DisplayRange"));

export type DisplayRange = v.InferOutput<typeof DisplayRangeSchema>;

export const DisplayRange = { schema: DisplayRangeSchema } as const;
