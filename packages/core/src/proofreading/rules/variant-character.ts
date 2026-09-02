import { graphemeSegmenter } from "../../internal/segmenter";
import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineParsedRule } from "./internal/define-rule";
import { sourceRange } from "./internal/rule-range";

/**
 * Mongolian free variation selectors, variation selectors, CJK compatibility ideographs, IVSes.
 */
function isVariantCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) return false;

  return (
    (codePoint >= 0x180b && codePoint <= 0x180d) ||
    codePoint === 0x180f ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0x2f800 && codePoint <= 0x2fa1f) ||
    (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
  );
}

/**
 * Variant forms of a character (異体字) and the selectors that request them (字形選択子 / IVS). Whether
 * such a form survives depends on the font and the platform, so a manuscript that relies on one
 * will not read the same everywhere it is published.
 *
 * Scans the source rather than the display text: notation removal must not hide a variant.
 */
export const variantCharacterRule = (): ParsedProofreadingRule =>
  defineParsedRule(
    "kg/variant-character",
    "異体字または字形選択子が使われています",
    (manuscript, report) => {
      for (const { index, segment } of graphemeSegmenter.segment(manuscript.source)) {
        if (Array.from(segment).some(isVariantCharacter)) {
          report(sourceRange(manuscript, { start: index, end: index + segment.length }));
        }
      }
    },
  );
