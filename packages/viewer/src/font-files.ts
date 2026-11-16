import { ManuscriptResult } from "@sushichan044/kg-core";
import type { FontPresetId } from "@sushichan044/kg-core";

import { typographyFonts } from "./typography-fonts";

export type TypographyLoadError = Readonly<{
  kind: "font-load" | "font-integrity" | "shaper-load";
}>;

export type FontFile = Readonly<{ weight: 400 | 700; data: ArrayBuffer }>;

export type FontUrls = Readonly<Partial<Record<400 | 700, string | URL>>>;

// fetch と crypto.subtle だけを使うので、Worker でも動く
export async function loadFontFiles(
  fontPreset: FontPresetId,
  fontUrls?: FontUrls,
): Promise<ManuscriptResult<readonly FontFile[], TypographyLoadError>> {
  const files = await Promise.all(
    typographyFonts[fontPreset].map(
      async (asset): Promise<ManuscriptResult<FontFile, TypographyLoadError>> => {
        try {
          const response = await fetch(fontUrls?.[asset.weight] ?? asset.url);
          if (!response.ok) return ManuscriptResult.fail({ kind: "font-load" });
          const data = await response.arrayBuffer();
          const digest = await crypto.subtle.digest("SHA-256", data);
          const sha = Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join("");
          if (sha !== asset.sha256) return ManuscriptResult.fail({ kind: "font-integrity" });
          return ManuscriptResult.succeed({ weight: asset.weight, data });
        } catch {
          return ManuscriptResult.fail({ kind: "font-load" });
        }
      },
    ),
  );
  const loaded: FontFile[] = [];
  for (const result of files) {
    if (!result.ok) return result;
    loaded.push(result.value);
  }
  return ManuscriptResult.succeed(loaded);
}
