import * as v from "valibot";

import { readonlyObject } from "../../internal/schema";
import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineProofreadingRule } from "../proofreading-rule-definition";
import { defineMatchRule } from "./internal/define-rule";

const RULE_ID = "kg/max-arabic-numeral-digits";
const DEFAULT_MAX_DIGITS = 2;

const MaxArabicNumeralDigitsOptionsSchema = readonlyObject({
  maxDigits: v.optional(
    v.pipe(v.number(), v.finite(), v.integer(), v.minValue(1)),
    DEFAULT_MAX_DIGITS,
  ),
});

function build(maxDigits: number): ParsedProofreadingRule {
  return defineMatchRule({
    id: RULE_ID,
    // Integer part and fractional part are counted separately.
    pattern: /([0-9０-９]+)(?:[.．]([0-9０-９]+))?/gu,
    accept: (match) => (match[1]?.length ?? 0) > maxDigits || (match[2]?.length ?? 0) > maxDigits,
    message: `${maxDigits}桁を超えるアラビア数字が使われています`,
  });
}

export const maxArabicNumeralDigitsRuleDefinition = defineProofreadingRule({
  id: RULE_ID,
  optionsSchema: v.optional(MaxArabicNumeralDigitsOptionsSchema, {}),
  create: ({ maxDigits }) => build(maxDigits),
});
