import * as v from "valibot";

import { readonlyObject } from "../../internal/schema";
import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineProofreadingRule } from "../proofreading-rule-definition";
import { OPENING_BRACKETS } from "./internal/brackets";
import { isDecorationLine } from "./internal/decoration-line";
import { splitDisplayLines } from "./internal/display-line";
import { displayRange } from "./internal/rule-range";
import { IDEOGRAPHIC_SPACE, leadingSpaces } from "./internal/spaces";

const RULE_ID = "kg/paragraph-opening";

const MESSAGES = {
  "leading-character": "段落の先頭には全角スペースまたは開き括弧が必要です",
  "indent-width": "段落冒頭の字下げは全角スペース1字にしてください",
  "unexpected-indent": "括弧から始まる段落を字下げすることはできません",
} as const;

const ParagraphOpeningOptionsSchema = readonlyObject({
  openingBrackets: v.optional(v.pipe(v.string(), v.nonEmpty()), OPENING_BRACKETS),
});

/**
 * How a paragraph opens, judged as one decision: a paragraph that opens with a bracket carries no
 * indent, and prose carries exactly one ideographic space. The three findings are branches of that
 * one decision rather than separate rules, so a line can never collect two of them at once.
 */
function build(openingBrackets: string): ParsedProofreadingRule {
  return {
    kind: "parsed",
    meta: { id: RULE_ID, messages: MESSAGES },
    check: (manuscript, context) => {
      const report = (start: number, end: number, messageId: keyof typeof MESSAGES) => {
        context.report({ range: displayRange(manuscript, start, end), messageId });
      };

      for (const line of splitDisplayLines(manuscript.displayText)) {
        if (isDecorationLine(line.text)) continue;

        const indent = leadingSpaces(line.text);
        // An empty line, or one holding nothing but spaces, opens no paragraph.
        const opening = line.text[indent.length];
        if (opening === undefined) continue;

        if (openingBrackets.includes(opening)) {
          if (indent !== "") report(line.start, line.start + indent.length, "unexpected-indent");
        } else if (!line.text.startsWith(IDEOGRAPHIC_SPACE)) {
          // A leading astral character occupies two UTF-16 code units.
          const length = (line.text.codePointAt(0) ?? 0) > 0xffff ? 2 : 1;
          report(line.start, line.start + length, "leading-character");
        } else if (indent.length !== 1) {
          report(line.start, line.start + indent.length, "indent-width");
        }
      }
    },
  };
}

export const paragraphOpeningRuleDefinition = defineProofreadingRule({
  id: RULE_ID,
  optionsSchema: v.optional(ParagraphOpeningOptionsSchema, {}),
  create: ({ openingBrackets }) => build(openingBrackets),
});
