import * as v from "valibot";

import { ManuscriptResult } from "../../result/manuscript-result";
import { ValidationIssue } from "../../result/validation-issue";
import type { InvalidRuleOptions } from "../invalid-rule-options";
import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

const RULE_ID = "kg/max-arabic-numeral-digits";
const DEFAULT_MAX_DIGITS = 2;

const MaxDigitsSchema = v.pipe(v.number(), v.finite(), v.integer(), v.minValue(1));

export type MaxArabicNumeralDigitsOptions = Readonly<{ maxDigits?: number }>;

/**
 * Arabic numerals in vertical writing (縦組). A short run is set as 縦中横 (JLReq 3.2.5) and stays
 * upright inside one em, but a longer one has nowhere to go: it either turns the line sideways or
 * breaks across it. The usual limit is two digits, past which a novel spells the number in kanji.
 */
function build(maxDigits: number): ParsedProofreadingRule {
  return defineMatchRule({
    id: RULE_ID,
    // Integer part and fractional part are counted separately.
    pattern: /([0-9０-９]+)(?:[.．]([0-9０-９]+))?/gu,
    accept: (match) => (match[1]?.length ?? 0) > maxDigits || (match[2]?.length ?? 0) > maxDigits,
    message: `${maxDigits}桁を超えるアラビア数字が使われています`,
  });
}

export const maxArabicNumeralDigitsRule = (): ParsedProofreadingRule => build(DEFAULT_MAX_DIGITS);

export function createMaxArabicNumeralDigitsRule(
  options: MaxArabicNumeralDigitsOptions = {},
): ManuscriptResult<ParsedProofreadingRule, InvalidRuleOptions> {
  if (options.maxDigits === undefined) {
    return ManuscriptResult.succeed(maxArabicNumeralDigitsRule());
  }

  const maxDigits = v.safeParse(MaxDigitsSchema, options.maxDigits);
  if (!maxDigits.success) {
    return ManuscriptResult.fail({
      kind: "InvalidRuleOptions",
      ruleId: RULE_ID,
      option: "maxDigits",
      issues: ValidationIssue.from(maxDigits.issues),
    });
  }

  return ManuscriptResult.succeed(build(maxDigits.output));
}
