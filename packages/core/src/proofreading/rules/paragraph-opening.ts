import * as v from "valibot";

import { OPENING_BRACKETS } from "../../internal/japanese-brackets";
import { IDEOGRAPHIC_SPACE, leadingSpaces } from "../../internal/japanese-spaces";
import { ManuscriptResult } from "../../result/manuscript-result";
import { ValidationIssue } from "../../result/validation-issue";
import type { InvalidRuleOptions } from "../invalid-rule-options";
import type { ParsedProofreadingRule } from "../proofreading-rule";
import { isDecorationLine } from "./internal/decoration-line";
import { splitDisplayLines } from "./internal/display-line";
import { displayRange } from "./internal/rule-range";

const RULE_ID = "kg/paragraph-opening";

const MESSAGES = {
  "leading-character": "段落の先頭には全角スペースまたは開き括弧が必要です",
  "indent-width": "段落冒頭の字下げは全角スペース1字にしてください",
  "unexpected-indent": "括弧から始まる段落を字下げすることはできません",
} as const;

const OpeningBracketsSchema = v.pipe(v.string(), v.nonEmpty());

export type ParagraphOpeningOptions = Readonly<{ openingBrackets?: string }>;

/**
 * 段落の字下げ（JLReq 3.5.1）。日本語の文章は、段落を全角空白（和字間隔）ちょうど 1 つで始める。
 * 始め括弧類で始まる段落には字下げをしない。括弧がすでに二分で組まれており、
 * それ自体が字下げのように読めるからである。
 *
 * 3 つの指摘は、別々のルールではなく 1 つの判断の分岐である。
 * そのため、1 行が 2 つの指摘を同時に受けることはない。
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
        // 空行、または空白だけの行は、段落を始めない。
        const opening = line.text[indent.length];
        if (opening === undefined) continue;

        if (openingBrackets.includes(opening)) {
          if (indent !== "") report(line.start, line.start + indent.length, "unexpected-indent");
        } else if (!line.text.startsWith(IDEOGRAPHIC_SPACE)) {
          // 行頭の BMP 外の文字は、UTF-16 のコード単位を 2 つ占める。
          const length = (line.text.codePointAt(0) ?? 0) > 0xffff ? 2 : 1;
          report(line.start, line.start + length, "leading-character");
        } else if (indent.length !== 1) {
          report(line.start, line.start + indent.length, "indent-width");
        }
      }
    },
  };
}

export const paragraphOpeningRule = (): ParsedProofreadingRule => build(OPENING_BRACKETS);

export function createParagraphOpeningRule(
  options: ParagraphOpeningOptions = {},
): ManuscriptResult<ParsedProofreadingRule, InvalidRuleOptions> {
  if (options.openingBrackets === undefined) {
    return ManuscriptResult.succeed(paragraphOpeningRule());
  }

  const brackets = v.safeParse(OpeningBracketsSchema, options.openingBrackets);
  if (!brackets.success) {
    return ManuscriptResult.fail({
      kind: "InvalidRuleOptions",
      ruleId: RULE_ID,
      option: "openingBrackets",
      issues: ValidationIssue.from(brackets.issues),
    });
  }

  return ManuscriptResult.succeed(build(brackets.output));
}
