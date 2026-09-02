import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

/**
 * A repeated interpunct (中黒, JLReq 中点類 cl-05). The interpunct separates items; repeating it is
 * almost always a stand-in for an ellipsis, which `kg/ellipsis-character` names properly.
 */
export const noConsecutiveInterpunctRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/no-consecutive-interpunct",
    pattern: /・・+/gu,
    message: "中黒が連続しています",
  });
