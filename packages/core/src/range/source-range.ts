import * as v from "valibot";

import { TextRange } from "./text-range";

const SourceRangeSchema = v.pipe(TextRange.schema, v.brand("SourceRange"));

/**
 * 加工していないソーステキストへの UTF-16 オフセット。サービス固有の記法も含む。
 */
export type SourceRange = v.InferOutput<typeof SourceRangeSchema>;

export const SourceRange = { schema: SourceRangeSchema } as const;
