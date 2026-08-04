import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

/**
 * Stand-ins for `―`. Repeated `ー` belongs to `kg/no-consecutive-choonpu` and `−` to
 * `kg/minus-before-number`, so neither is reported twice.
 */
export const dashCharacterRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/dash-character",
    pattern: /[—–─━﹣]+|-{2,}/gu,
    message: "ダッシュには「―」を使ってください",
  });
