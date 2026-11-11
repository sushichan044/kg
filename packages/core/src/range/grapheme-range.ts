import * as v from "valibot";

import { TextRange } from "./text-range";

const GraphemeRangeSchema = v.pipe(TextRange.schema, v.brand("GraphemeRange"));

/**
 * 表示用書記素配列へのインデックスであり、どの文字列へのオフセットでもない。
 * 書記素は、読み手が 1 文字と数えるものであり、コンポーザーが全角 1 つ分に組むものである。
 * したがって、基底文字とその結合文字、あるいは複数の符号位置から成る絵文字は、1 つとして数える。
 */
export type GraphemeRange = v.InferOutput<typeof GraphemeRangeSchema>;

export const GraphemeRange = { schema: GraphemeRangeSchema } as const;
