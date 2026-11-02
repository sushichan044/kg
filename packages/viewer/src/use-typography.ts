import type { FontPresetId } from "@sushichan044/kg-core";
import { useEffect, useState } from "react";

import { loadTypography } from "./typography";
import type { ReadyTypography, TypographyLoadError } from "./typography";

export type TypographyState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "ready"; typography: ReadyTypography }>
  | Readonly<{ kind: "failed"; error: TypographyLoadError }>;

/**
 * Own a font resource until the selection changes or the component unmounts.
 */
export function useTypography(
  fontPreset: FontPresetId,
): TypographyState & Readonly<{ retry: () => void }> {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Readonly<{
    fontPreset: FontPresetId;
    attempt: number;
    state: TypographyState;
  }> | null>(null);
  if (loaded !== null && (loaded.fontPreset !== fontPreset || loaded.attempt !== attempt))
    setLoaded(null);
  useEffect(() => {
    let cancelled = false;
    let owned: ReadyTypography | undefined;
    void loadTypography({ fontPreset }).then((result) => {
      if (cancelled) {
        if (result.ok) result.value.dispose();
        return;
      }
      if (result.ok) owned = result.value;
      setLoaded({
        fontPreset,
        attempt,
        state: result.ok
          ? { kind: "ready", typography: result.value }
          : { kind: "failed", error: result.error },
      });
    });
    return () => {
      cancelled = true;
      owned?.dispose();
    };
  }, [fontPreset, attempt]);
  const state: TypographyState =
    loaded?.fontPreset === fontPreset && loaded.attempt === attempt
      ? loaded.state
      : { kind: "loading" };
  return {
    ...state,
    retry: () => {
      if (state.kind === "failed" && state.error.kind === "shaper-load") window.location.reload();
      else setAttempt((value) => value + 1);
    },
  };
}
