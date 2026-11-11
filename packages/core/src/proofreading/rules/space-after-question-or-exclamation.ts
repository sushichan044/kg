import * as v from "valibot";

import { assertNever } from "../../internal/assert-never";
import { validAdditionalSentenceEndingMarks } from "../../internal/japanese-punctuation";
import { questionOrExclamationSpacings } from "../../internal/question-or-exclamation-spacing";
import { ManuscriptResult } from "../../result/manuscript-result";
import { ValidationIssue } from "../../result/validation-issue";
import type { InvalidRuleOptions } from "../invalid-rule-options";
import type { ParsedProofreadingRule } from "../proofreading-rule";
import { splitDisplayLines } from "./internal/display-line";
import { displayRange } from "./internal/rule-range";

const RULE_ID = "kg/space-after-question-or-exclamation";

const MESSAGES = {
  default: "文末記号の直後には全角スペースか閉じ括弧が必要です",
  "space-width": "文末記号の直後の空白は全角スペース1字にしてください",
  "before-closing-bracket": "閉じ括弧の直前に空白を置くことはできません",
} as const;

/**
 * ！や？の連なりそれぞれの後に続くアキ（区切り約物、JLReq 3.1.6）。
 * 区切り約物は句点なしで文を終えるので、句点があれば担っていたはずのアキの代わりに、
 * 全角分の空白を置く。行末や終わり括弧類の直前にある連なりは、
 * すでに後続と区切られているのでアキが不要である。それ以外の位置では、全角空白をちょうど 1 つ取る。
 */
const build = (additionalSentenceEndingMarks = ""): ParsedProofreadingRule => ({
  kind: "parsed",
  meta: { id: RULE_ID, messages: MESSAGES },
  check: (manuscript, context) => {
    const report = (start: number, end: number, messageId: keyof typeof MESSAGES) => {
      context.report({ range: displayRange(manuscript, start, end), messageId });
    };

    for (const line of splitDisplayLines(manuscript.displayText)) {
      for (const spacing of questionOrExclamationSpacings(
        line.text,
        additionalSentenceEndingMarks,
      )) {
        switch (spacing.kind) {
          case "valid": {
            break;
          }
          case "missing": {
            report(line.start + spacing.marks.start, line.start + spacing.marks.end, "default");
            break;
          }
          case "invalid-space": {
            report(line.start + spacing.gap.start, line.start + spacing.gap.end, "space-width");
            break;
          }
          case "before-closing-bracket": {
            report(
              line.start + spacing.gap.start,
              line.start + spacing.gap.end,
              "before-closing-bracket",
            );
            break;
          }
          default: {
            assertNever(spacing);
          }
        }
      }
    }
  },
});

export const spaceAfterQuestionOrExclamationRule = (): ParsedProofreadingRule => build();
export type SpaceAfterQuestionOrExclamationOptions = Readonly<{
  additionalSentenceEndingMarks?: string;
}>;
export function createSpaceAfterQuestionOrExclamationRule(
  options: SpaceAfterQuestionOrExclamationOptions = {},
): ManuscriptResult<ParsedProofreadingRule, InvalidRuleOptions> {
  const result = v.safeParse(
    v.pipe(v.string(), v.check(validAdditionalSentenceEndingMarks)),
    options.additionalSentenceEndingMarks === undefined
      ? ""
      : options.additionalSentenceEndingMarks,
  );
  if (!result.success)
    return ManuscriptResult.fail({
      kind: "InvalidRuleOptions",
      ruleId: RULE_ID,
      option: "additionalSentenceEndingMarks",
      issues: ValidationIssue.from(result.issues),
    });
  return ManuscriptResult.succeed(build(result.output));
}
