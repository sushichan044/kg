import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

export const evenDashRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/even-dash",
    pattern: /―+/gu,
    accept: (match) => match[0].length % 2 === 1,
    message: "連続するダッシュの数は偶数にしてください",
  });
