import * as v from "valibot";

import { readonlyObject } from "../../internal/schema";
import { ManuscriptRange } from "../../range/manuscript-range";

const EmphasisAnnotationSchema = readonlyObject({
  kind: v.literal("emphasis"),
  range: ManuscriptRange.schema,
  mark: v.string(),
});

/**
 * 圏点（JLReq 3.3.9）。親文字の連なりのすべての文字の脇に、同じ記号を繰り返す。日本語の文章が、
 * イタリックの代わりに語句を強調する方法である。`mark` は繰り返す文字。記法によっては固定され、
 * ソースに指定させるものもあるので、パーサーは正規化せず、書かれたとおりに記録する。
 */
export type EmphasisAnnotation = v.InferOutput<typeof EmphasisAnnotationSchema>;

export const EmphasisAnnotation = { schema: EmphasisAnnotationSchema } as const;
