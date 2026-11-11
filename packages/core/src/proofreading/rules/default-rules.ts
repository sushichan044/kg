import type { ParsedProofreadingRule } from "../proofreading-rule";
import { dashRule } from "./dash";
import { ellipsisCharacterRule } from "./ellipsis-character";
import { evenEllipsisRule } from "./even-ellipsis";
import { fullwidthJapanesePunctuationRule } from "./fullwidth-japanese-punctuation";
import { maxArabicNumeralDigitsRule } from "./max-arabic-numeral-digits";
import { minusBeforeNumberRule } from "./minus-before-number";
import { noConsecutiveInterpunctRule } from "./no-consecutive-interpunct";
import { noConsecutivePunctuationRule } from "./no-consecutive-punctuation";
import { paragraphOpeningRule } from "./paragraph-opening";
import { punctuationBeforeClosingQuoteRule } from "./punctuation-before-closing-quote";
import { spaceAfterQuestionOrExclamationRule } from "./space-after-question-or-exclamation";
import { variantCharacterRule } from "./variant-character";

/**
 * 既定の構成での組み込みルール一式。構成上、失敗しない。すべてのルールが定数から作られるので、
 * 呼び出し側が扱うべきオプションのエラーは存在しない。
 *
 * 答えが作品固有の慣習に依存するルール（数字がどの幅を取るか、語を漢字で書くかかなで書くか）は、
 * ここに含めず個別にエクスポートする。
 */
export function createDefaultProofreadingRules(): readonly ParsedProofreadingRule[] {
  return [
    paragraphOpeningRule(),
    punctuationBeforeClosingQuoteRule(),
    spaceAfterQuestionOrExclamationRule(),
    evenEllipsisRule(),
    dashRule(),
    ellipsisCharacterRule(),
    noConsecutivePunctuationRule(),
    noConsecutiveInterpunctRule(),
    minusBeforeNumberRule(),
    maxArabicNumeralDigitsRule(),
    fullwidthJapanesePunctuationRule(),
    variantCharacterRule(),
  ];
}
