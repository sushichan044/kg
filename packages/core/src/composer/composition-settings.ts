import * as v from "valibot";

import { ManuscriptAppearanceSettings } from "../appearance/appearance-settings";
import { readonlyObject } from "../internal/schema";
import { LineOffset } from "./line-offset";
import { ManuscriptOffsets } from "./manuscript-offsets";
import { NovelFlowSettings } from "./novel-flow-settings";

const NovelCompositionSettingsSchema = v.pipe(
  readonlyObject({
    flow: NovelFlowSettings.schema,
    offsets: ManuscriptOffsets.schema,
    appearance: ManuscriptAppearanceSettings.schema,
  }),
  v.check(
    ({ flow, offsets }) =>
      LineOffset.total(offsets.stage) <= ManuscriptOffsets.maxStageTotal(flow) &&
      LineOffset.total(offsets.page) <= ManuscriptOffsets.maxPageTotal(flow, offsets.stage),
    "page or stage offsets leave no usable novel lines",
  ),
);

/**
 * Every value that changes placement or physical size. Zoom and UI selection live in the app.
 */
export type NovelCompositionSettings = v.InferOutput<typeof NovelCompositionSettingsSchema>;

export const NovelCompositionSettings = {
  schema: NovelCompositionSettingsSchema,

  defaults: {
    flow: NovelFlowSettings.defaults,
    offsets: ManuscriptOffsets.defaults,
    appearance: ManuscriptAppearanceSettings.defaults,
  } as const satisfies NovelCompositionSettings,

  is: (value: unknown): value is NovelCompositionSettings =>
    v.is(NovelCompositionSettingsSchema, value),
} as const;
