import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

/**
 * 句点または読点の連続（句読点。JLReq の句点類 cl-06 と読点類 cl-07）。
 * それぞれ節を 1 度だけ終えるものなので、連なりは句読点ではなく、言葉が尾を引く表現である。
 * 日本語の文章はこれを `…` で書く。
 */
export const noConsecutivePunctuationRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/no-consecutive-punctuation",
    pattern: /。。+|、、+/gu,
    message: "句読点が連続しています",
  });
