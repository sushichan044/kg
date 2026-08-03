import * as v from "valibot";

import { ManuscriptAppearanceSettings } from "../appearance/appearance-settings";
import { readonlyObject } from "../internal/schema";
import { GridSettings } from "./grid-settings";
import { LineOffset } from "./line-offset";
import { ManuscriptOffsets } from "./manuscript-offsets";

const ManuscriptCompositionSettingsSchema = v.pipe(
  readonlyObject({
    grid: GridSettings.schema,
    offsets: ManuscriptOffsets.schema,
    appearance: ManuscriptAppearanceSettings.schema,
  }),
  v.check(
    ({ grid, offsets }) =>
      LineOffset.total(offsets.stage) <= ManuscriptOffsets.maxStageTotal(grid) &&
      LineOffset.total(offsets.page) <= ManuscriptOffsets.maxPageTotal(grid, offsets.stage),
    "page or stage offsets leave no usable manuscript lines",
  ),
);

/**
 * Every value that changes placement or physical size. Zoom and UI selection live in the app.
 */
export type ManuscriptCompositionSettings = v.InferOutput<
  typeof ManuscriptCompositionSettingsSchema
>;

export const ManuscriptCompositionSettings = {
  schema: ManuscriptCompositionSettingsSchema,

  defaults: {
    grid: GridSettings.defaults,
    offsets: ManuscriptOffsets.defaults,
    appearance: ManuscriptAppearanceSettings.defaults,
  } as const satisfies ManuscriptCompositionSettings,

  is: (value: unknown): value is ManuscriptCompositionSettings =>
    v.is(ManuscriptCompositionSettingsSchema, value),
} as const;
