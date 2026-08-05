import { graphemeSegmenter } from "../../internal/segmenter";
import type { ParsedProofreadingRule } from "../proofreading-rule";
import { sourceRange } from "./internal/rule-range";

const RULE_ID = "kg/variant-character";

const MESSAGES = {
  default: "異体字または字形選択子が使われています",
  "with-suggestion":
    "異体字または字形選択子が使われています。「{{ suggestion }}」ではありませんか？",
} as const;

/**
 * Mongolian free variation selectors, variation selectors (incl. emoji presentation), IVSes: all
 * combine with a preceding base character rather than standing on their own.
 */
function isSelector(codePoint: number): boolean {
  return (
    (codePoint >= 0x180b && codePoint <= 0x180d) ||
    codePoint === 0x180f ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
  );
}

/**
 * CJK compatibility ideographs stand alone; each has a canonical unified form reachable via NFKC.
 */
function isCompatibilityIdeograph(codePoint: number): boolean {
  return (
    (codePoint >= 0xf900 && codePoint <= 0xfaff) || (codePoint >= 0x2f800 && codePoint <= 0x2fa1f)
  );
}

function isVariantCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) return false;

  return isSelector(codePoint) || isCompatibilityIdeograph(codePoint);
}

/**
 * The plain form a reader would expect: the selector stripped away, or the compatibility
 * ideograph's canonical unified form. Undefined when that plain form is identical to the original,
 * since NFKC does not touch selectors and a suggestion equal to the input helps no one.
 */
function suggestPlainForm(segment: string): string | undefined {
  const withoutSelectors = Array.from(segment)
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && !isSelector(codePoint);
    })
    .join("");

  if (withoutSelectors === "") return undefined;

  const normalized = Array.from(withoutSelectors)
    .map((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && isCompatibilityIdeograph(codePoint)
        ? character.normalize("NFKC")
        : character;
    })
    .join("");

  return normalized === segment ? undefined : normalized;
}

/**
 * Scans the source rather than the display text: notation removal must not hide a variant.
 */
export const variantCharacterRule = (): ParsedProofreadingRule => ({
  kind: "parsed",
  meta: { id: RULE_ID, messages: MESSAGES },
  check: (manuscript, context) => {
    for (const { index, segment } of graphemeSegmenter.segment(manuscript.source)) {
      if (!Array.from(segment).some(isVariantCharacter)) continue;

      const range = sourceRange(manuscript, { start: index, end: index + segment.length });
      const suggestion = suggestPlainForm(segment);
      if (suggestion === undefined) {
        context.report({ range, messageId: "default" });
      } else {
        context.report({ range, messageId: "with-suggestion", data: { suggestion } });
      }
    }
  },
});
