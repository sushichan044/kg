import type { ParsedProofreadingRule } from "../proofreading-rule";
import { CLOSING_BRACKETS } from "./internal/brackets";
import { splitDisplayLines } from "./internal/display-line";
import { displayRange } from "./internal/rule-range";
import { IDEOGRAPHIC_SPACE, leadingSpaces } from "./internal/spaces";

const RULE_ID = "kg/space-after-question-or-exclamation";

const MESSAGES = {
  default: "感嘆符または疑問符の直後には全角スペースか閉じ括弧が必要です",
  "space-width": "感嘆符または疑問符の直後の空白は全角スペース1字にしてください",
  "before-closing-bracket": "閉じ括弧の直前に空白を置くことはできません",
} as const;

/**
 * Runs, not single marks: `！？` is one mark and takes one gap, so the gap belongs after the run.
 */
const MARKS = /[？！]+/gu;

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
      for (const marks of line.text.matchAll(MARKS)) {
        const marksEnd = marks.index + marks[0].length;
        const next = line.text[marksEnd];
        if (next === undefined || CLOSING_BRACKETS.includes(next)) continue;

        const spaces = leadingSpaces(line.text.slice(marksEnd));
        if (spaces === "") {
          report(line.start + marks.index, line.start + marksEnd, "default");
          continue;
        }

        const following = line.text[marksEnd + spaces.length];
        const spacesStart = line.start + marksEnd;
        const spacesEnd = spacesStart + spaces.length;
        if (following !== undefined && CLOSING_BRACKETS.includes(following)) {
          report(spacesStart, spacesEnd, "before-closing-bracket");
        } else if (spaces !== IDEOGRAPHIC_SPACE) {
          report(spacesStart, spacesEnd, "space-width");
        }
      }
    }
  },
});
