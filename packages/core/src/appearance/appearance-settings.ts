import type * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { FontPresetId } from "./font-preset-id";
import { FontSizePt } from "./font-size-pt";
import { PaperSizeId } from "./paper-size-id";

const ManuscriptAppearanceSettingsSchema = readonlyObject({
  paperSize: PaperSizeId.schema,
  fontSizePt: FontSizePt.schema,
  fontPreset: FontPresetId.schema,
});

/**
 * Everything that changes the physical dimensions of a page, but not how text fills the grid.
 */
export type ManuscriptAppearanceSettings = v.InferOutput<typeof ManuscriptAppearanceSettingsSchema>;

export const ManuscriptAppearanceSettings = {
  schema: ManuscriptAppearanceSettingsSchema,

  defaults: {
    paperSize: "a5",
    fontSizePt: 9,
    fontPreset: "mincho",
  } as const satisfies ManuscriptAppearanceSettings,
} as const;
