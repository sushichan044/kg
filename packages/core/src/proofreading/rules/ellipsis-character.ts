import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

/**
 * Stand-ins for the ellipsis (三点リーダー) `…`. Only the real character is set on its own em and pairs
 * into a 2倍リーダ; a run of ASCII periods is neither. Runs of `。` and `・` are left to the rules that
 * already count them, so one substitute is never reported twice.
 */
export const ellipsisCharacterRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/ellipsis-character",
    pattern: /\.{3,}|⋯+/gu,
    message: "三点リーダーには「…」を使ってください",
  });
