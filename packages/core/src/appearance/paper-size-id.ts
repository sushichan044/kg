import * as v from "valibot";

const PaperSizeIdSchema = v.picklist(["a4", "a5", "a6", "jis-b5", "jis-b6", "shinsho"]);

export type PaperSizeId = v.InferOutput<typeof PaperSizeIdSchema>;

export const PaperSizeId = {
  schema: PaperSizeIdSchema,

  is: (value: unknown): value is PaperSizeId => v.is(PaperSizeIdSchema, value),
} as const;
