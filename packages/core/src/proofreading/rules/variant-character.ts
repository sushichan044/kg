import { graphemeSegmenter } from "../../internal/segmenter";
import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineParsedRule } from "./internal/define-rule";
import { sourceRange } from "./internal/rule-range";

/**
 * モンゴル語の自由字形選択子、字形選択子、CJK 互換漢字、IVS。
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
 * 文字の異体字と、それを要求するセレクター（字形選択子 / IVS）。
 * 異体字が残るかどうかはフォントとプラットフォームに依存する。そのため、異体字に頼った原稿は、
 * 公開先によって同じようには読めない。
 *
 * 表示用テキストではなくソースを走査する。記法の除去によって異体字が隠れてはならないからである。
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
