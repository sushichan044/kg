import * as v from "valibot";

const PaperSizeIdSchema = v.picklist(["a4", "a5", "a6", "jis-b5", "jis-b6", "shinsho"]);

/**
 * ISO A sizes, the JIS B series (which is not the ISO B series), and the two trim sizes Japanese
 * publishing names rather than measures: A6 is the 文庫本 and `shinsho` the 新書判.
 */
export type PaperSizeId = v.InferOutput<typeof PaperSizeIdSchema>;

export const PaperSizeId = {
  schema: PaperSizeIdSchema,

  is: (value: unknown): value is PaperSizeId => v.is(PaperSizeIdSchema, value),
} as const;
