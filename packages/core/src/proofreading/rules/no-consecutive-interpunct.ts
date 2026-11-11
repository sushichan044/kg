import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

/**
 * 中黒の連続（JLReq の中点類 cl-05）。中黒は項目を区切るものであり、繰り返すのは、ほとんどの場合、
 * 三点リーダの代用である。三点リーダは `kg/ellipsis-character` が正しく扱う。
 */
export const noConsecutiveInterpunctRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/no-consecutive-interpunct",
    pattern: /・・+/gu,
    message: "中黒が連続しています",
  });
