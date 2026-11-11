import type { FontPresetId } from "@sushichan044/kg-core";
import { startTransition, use, useState } from "react";

import type { ReadyTypography, TypographyLoadError } from "./typography";
import { TypographyContext } from "./TypographyProvider";

export type TypographyState =
  | Readonly<{ kind: "ready"; typography: ReadyTypography }>
  | Readonly<{ kind: "failed"; error: TypographyLoadError; retry: () => void }>;

/**
 * 最も近い TypographyProvider のキャッシュから書体を読み、読み込みが終わるまで中断する
 */
export function useTypography(fontPreset: FontPresetId): TypographyState {
  const cache = use(TypographyContext);
  if (cache === null) throw new Error("useTypography must be used within a TypographyProvider");
  const [attempt, setAttempt] = useState(0);
  const result = use(cache.load(fontPreset, attempt));
  if (result.ok) return { kind: "ready", typography: result.value };
  const { error } = result;
  return {
    kind: "failed",
    error,
    retry: () => {
      // シェーパーの読み込みに失敗した import() はブラウザーに記録され、再読み込みしないとやり直せない
      if (error.kind === "shaper-load") {
        window.location.reload();
        return;
      }
      startTransition(() => {
        setAttempt(cache.nextAttempt(fontPreset));
      });
    },
  };
}
