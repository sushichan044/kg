import * as v from "valibot";

const FontPresetIdSchema = v.picklist(["mincho", "gothic", "genei-koburi"]);

/**
 * Built-in typography profiles. The persisted mincho ID selects Rin Mincho.
 */
export type FontPresetId = v.InferOutput<typeof FontPresetIdSchema>;

export const FontPresetId = {
  schema: FontPresetIdSchema,

  is: (value: unknown): value is FontPresetId => v.is(FontPresetIdSchema, value),
} as const;
