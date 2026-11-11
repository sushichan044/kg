import * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";

const ParsedGraphemeSchema = readonlyObject({
  value: v.string(),
  range: ManuscriptRange.schema,
});

/**
 * 表示用テキストのうち、利用者が 1 文字と知覚する単位。どこに由来するかへの対応付けを持つ。
 */
export type ParsedGrapheme = v.InferOutput<typeof ParsedGraphemeSchema>;

export const ParsedGrapheme = { schema: ParsedGraphemeSchema } as const;
