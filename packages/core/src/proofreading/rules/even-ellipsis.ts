import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

/**
 * The ellipsis a novel sets is the 2倍リーダ: two copies of `…` read as one mark six dots long. An odd
 * run leaves half of it, the same way an odd dash run does.
 */
export const evenEllipsisRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/even-ellipsis",
    pattern: /…+/gu,
    accept: (match) => match[0].length % 2 === 1,
    message: "連続する三点リーダーの数は偶数にしてください",
  });
