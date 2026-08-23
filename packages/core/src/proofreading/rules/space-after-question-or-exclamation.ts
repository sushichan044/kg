import { assertNever } from "../../assert-never";
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
 * Checks the gap that follows every run of ！ or ？. A run at the end of a line or right before a
 * closing bracket needs no gap; anywhere else it takes exactly one ideographic space.
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
