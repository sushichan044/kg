import type { ParsedProofreadingRule } from "../proofreading-rule";
import { OPENING_BRACKETS } from "./internal/brackets";
import { isDecorationLine } from "./internal/decoration-line";
import { defineParsedRule } from "./internal/define-rule";
import { splitDisplayLines } from "./internal/display-line";
import { displayRange } from "./internal/rule-range";
import { IDEOGRAPHIC_SPACE, leadingSpaces } from "./internal/spaces";

/**
 * A paragraph that is indented at all is indented by exactly one ideographic space. A paragraph
 * with no indent at all belongs to `kg/paragraph-leading-character`, and an indented bracket
 * paragraph to `kg/no-indent-before-opening-bracket`, so neither is reported twice.
 */
export const paragraphIndentWidthRule = (): ParsedProofreadingRule =>
  defineParsedRule(
    "kg/paragraph-indent-width",
    "段落冒頭の字下げは全角スペース1字にしてください",
    (manuscript, report) => {
      for (const line of splitDisplayLines(manuscript.displayText)) {
        if (!line.text.startsWith(IDEOGRAPHIC_SPACE)) continue;
        if (isDecorationLine(line.text)) continue;

        const indent = leadingSpaces(line.text);
        if (indent.length === 1) continue;

        const body = line.text[indent.length];
        if (body === undefined || OPENING_BRACKETS.includes(body)) continue;

        report(displayRange(manuscript, line.start, line.start + indent.length));
      }
    },
  );
