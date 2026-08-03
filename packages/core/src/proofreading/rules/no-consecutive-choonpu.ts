import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

export const noConsecutiveChoonpuRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/no-consecutive-choonpu",
    pattern: /ーー+/gu,
    message: "長音符が連続しています",
  });
