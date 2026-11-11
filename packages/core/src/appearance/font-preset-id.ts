import * as v from "valibot";

const FontPresetIdSchema = v.picklist(["mincho", "gothic", "genei-koburi"]);

/**
 * 組み込みのタイポグラフィのプロファイル。永続化された `mincho` の ID は Rin Mincho を選ぶ。
 */
export type FontPresetId = v.InferOutput<typeof FontPresetIdSchema>;

export const FontPresetId = {
  schema: FontPresetIdSchema,

  is: (value: unknown): value is FontPresetId => v.is(FontPresetIdSchema, value),
} as const;
