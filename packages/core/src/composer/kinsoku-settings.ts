import * as v from "valibot";

import { readonlyObject } from "../internal/schema";

const KinsokuSettingsSchema = readonlyObject({
  enabled: v.boolean(),
  hangingPunctuation: v.boolean(),
});

/**
 * Whether the grid composer avoids illegal line breaks (line-start and line-end prohibited
 * characters, non-separable runs) and, among those, whether it hangs trailing punctuation off the
 * line instead of pushing it to the next one.
 */
export type KinsokuSettings = v.InferOutput<typeof KinsokuSettingsSchema>;

export const KinsokuSettings = {
  schema: KinsokuSettingsSchema,

  defaults: {
    enabled: true,
    hangingPunctuation: true,
  } as const satisfies KinsokuSettings,
} as const;
