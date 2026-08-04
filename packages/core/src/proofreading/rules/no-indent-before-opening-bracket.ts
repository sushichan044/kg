import type { ParsedProofreadingRule } from "../proofreading-rule";
import { OPENING_BRACKETS } from "./internal/brackets";
import { isDecorationLine } from "./internal/decoration-line";
import { defineParsedRule } from "./internal/define-rule";
import { splitDisplayLines } from "./internal/display-line";
import { displayRange } from "./internal/rule-range";
import { leadingSpaces } from "./internal/spaces";

/**
 * A paragraph that opens with a bracket carries its own indent, so the spaces before it are extra.
 */
export const noIndentBeforeOpeningBracketRule = (): ParsedProofreadingRule =>
  defineParsedRule(
    "kg/no-indent-before-opening-bracket",
    "括弧から始まる段落を字下げすることはできません",
    (manuscript, report) => {
      for (const line of splitDisplayLines(manuscript.displayText)) {
        if (isDecorationLine(line.text)) continue;

        const indent = leadingSpaces(line.text);
        if (indent === "") continue;

        const body = line.text[indent.length];
        if (body === undefined || !OPENING_BRACKETS.includes(body)) continue;

        report(displayRange(manuscript, line.start, line.start + indent.length));
      }
    },
  );
