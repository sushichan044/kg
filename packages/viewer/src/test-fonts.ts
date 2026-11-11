import { FontPreset } from "@sushichan044/kg-core";

import { typographyFonts } from "./typography-fonts";

/**
 * Fonts.css で宣言した同梱の書体を、すべて読み込み終えるまで待つ
 *
 * `@font-face` の書体は初めて使われたときに取得されるので、字形の大きさを読むテストは先にこれを待つ
 */
export async function loadBundledFonts(): Promise<void> {
  const faces = FontPreset.all.flatMap(({ id, fontName }) =>
    typographyFonts[id].map(({ weight }) => `${weight} 16px "${fontName}"`),
  );
  const loaded = await Promise.all(faces.map((font) => document.fonts.load(font, "あ")));
  const missing = faces.filter((_, index) => loaded[index]?.length === 0);
  if (missing.length > 0)
    throw new Error(`Bundled fonts are not declared; import fonts.css: ${missing.join(", ")}`);
}
