import * as v from "valibot";

const PaperSizeIdSchema = v.picklist(["a4", "a5", "a6", "jis-b5", "jis-b6", "shinsho"]);

/**
 * ISO の A 判、JIS の B 判（ISO の B 判とは別物）、
 * そして日本の出版で寸法ではなく名前で呼ぶ 2 つの仕上りサイズ。A6 は文庫本、
 * `shinsho` は新書判である。
 */
export type PaperSizeId = v.InferOutput<typeof PaperSizeIdSchema>;

export const PaperSizeId = {
  schema: PaperSizeIdSchema,

  is: (value: unknown): value is PaperSizeId => v.is(PaperSizeIdSchema, value),
} as const;
