import * as v from "valibot";

const FontPresetIdSchema = v.picklist(["mincho", "gothic"]);

/**
 * The two typeface families Japanese body text is set in: 明朝体, the serifed face a novel is normally
 * set in, and ゴシック体, its sans-serif counterpart.
 */
export type FontPresetId = v.InferOutput<typeof FontPresetIdSchema>;

export const FontPresetId = {
  schema: FontPresetIdSchema,

  is: (value: unknown): value is FontPresetId => v.is(FontPresetIdSchema, value),
} as const;
