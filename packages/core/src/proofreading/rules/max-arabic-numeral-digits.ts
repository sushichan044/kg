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
 * 縦組のアラビア数字。短い連なりは縦中横（JLReq 3.2.5）として組まれ、全角の枠の中に正立するが、
 * 長い連なりは枠に収まらず、横倒しになるか、枠をまたいで分割される。通常の上限は 2 桁で、
 * それを超える数は小説では漢数字で表記する。
 */
function build(maxDigits: number): ParsedProofreadingRule {
  return defineMatchRule({
    id: RULE_ID,
    // 整数部と小数部は別々に数える。
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
