import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

export const evenEllipsisRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/even-ellipsis",
    pattern: /…+/gu,
    accept: (match) => match[0].length % 2 === 1,
    message: "連続する三点リーダーの数は偶数にしてください",
  });
