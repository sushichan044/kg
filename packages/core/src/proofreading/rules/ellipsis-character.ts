import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

/**
 * Stand-ins for `…`. Runs of `。` and `・` are left to the rules that already count them, so one
 * substitute is never reported twice.
 */
export const ellipsisCharacterRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/ellipsis-character",
    pattern: /\.{3,}|⋯+/gu,
    message: "三点リーダーには「…」を使ってください",
  });
