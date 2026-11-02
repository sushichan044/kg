import type { FontTextTransform } from "../font-preset";

const transforms: Readonly<Record<FontTextTransform, (text: string) => string>> = {
  "combine-kana-voicing-marks": (text) =>
    text.replace(
      /([\u3041-\u3096\u30A1-\u30FA\u31F0-\u31FF])([\u309B\u309C])/gu,
      (_, kana: string, mark: string) => kana + (mark === "\u309B" ? "\u3099" : "\u309A"),
    ),
};

export function applyFontTextTransforms(text: string, rules: readonly FontTextTransform[]): string {
  return rules.reduce((value, rule) => transforms[rule](value), text);
}
