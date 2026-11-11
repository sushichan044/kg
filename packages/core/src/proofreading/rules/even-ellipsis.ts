import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

/**
 * 小説が組む三点リーダは 2倍リーダ、すなわち `…` を 2 つ並べて、
 * 点 6 つ分の 1 つの約物として読ませるものである。奇数個の連なりは、
 * 奇数個のダッシュの連なりと同様に、半分が余る。
 */
export const evenEllipsisRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/even-ellipsis",
    pattern: /…+/gu,
    accept: (match) => match[0].length % 2 === 1,
    message: "連続する三点リーダーの数は偶数にしてください",
  });
