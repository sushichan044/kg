import type * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { A5_PAGE_FORMAT } from "./a5-page-format";
import { FontPresetId } from "./font-preset-id";
import { FontSizeQ } from "./font-size-q";
import { PaperSizeId } from "./paper-size-id";

const ManuscriptAppearanceSettingsSchema = readonlyObject({
  paperSize: PaperSizeId.schema,
  fontSizeQ: FontSizeQ.schema,
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
    fontSizeQ: A5_PAGE_FORMAT.fontSizeQ,
    fontPreset: "mincho",
  } as const satisfies ManuscriptAppearanceSettings,
} as const;
