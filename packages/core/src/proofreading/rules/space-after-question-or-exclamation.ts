import { assertNever } from "../../internal/assert-never";
import { questionOrExclamationSpacings } from "../../internal/question-or-exclamation-spacing";
import type { ParsedProofreadingRule } from "../proofreading-rule";
import { splitDisplayLines } from "./internal/display-line";
import { displayRange } from "./internal/rule-range";

const RULE_ID = "kg/space-after-question-or-exclamation";

const MESSAGES = {
  default: "感嘆符または疑問符の直後には全角スペースか閉じ括弧が必要です",
  "space-width": "感嘆符または疑問符の直後の空白は全角スペース1字にしてください",
  "before-closing-bracket": "閉じ括弧の直前に空白を置くことはできません",
} as const;

/**
 * The gap that follows every run of ！ or ？ (区切り約物, JLReq 3.1.6). A dividing punctuation mark ends a
 * sentence without a full stop, so a full em of white stands in for the one a 句点 would have
 * carried. A run at the end of a line or right before a closing bracket is already separated from
 * what follows and needs no gap; anywhere else it takes exactly one ideographic space.
 */
export const spaceAfterQuestionOrExclamationRule = (): ParsedProofreadingRule => ({
  kind: "parsed",
  meta: { id: RULE_ID, messages: MESSAGES },
  check: (manuscript, context) => {
    const report = (start: number, end: number, messageId: keyof typeof MESSAGES) => {
      context.report({ range: displayRange(manuscript, start, end), messageId });
    };

    for (const line of splitDisplayLines(manuscript.displayText)) {
      for (const spacing of questionOrExclamationSpacings(line.text)) {
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
