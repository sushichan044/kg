import * as v from "valibot";

import { ManuscriptResult } from "../../result/manuscript-result";
import { ValidationIssue } from "../../result/validation-issue";
import type { InvalidRuleOptions } from "../invalid-rule-options";
import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineParsedRule } from "./internal/define-rule";
import { splitDisplayLines } from "./internal/display-line";
import { displayRange } from "./internal/rule-range";

const RULE_ID = "kg/paragraph-leading-character";
const MESSAGE = "段落の先頭には全角スペースまたは開き括弧が必要です";
const DEFAULT_ALLOWED_CHARACTERS = "　「『〖〈《（(“\"‘'［[〔｛{＜<";

const AllowedCharactersSchema = v.pipe(v.string(), v.nonEmpty());

export type ParagraphLeadingCharacterOptions = Readonly<{ allowedCharacters?: string }>;

function build(allowedCharacters: string): ParsedProofreadingRule {
  return defineParsedRule(RULE_ID, MESSAGE, (manuscript, report) => {
    for (const line of splitDisplayLines(manuscript.displayText)) {
      const leading = line.text[0];
      if (leading === undefined || allowedCharacters.includes(leading)) continue;
      // A leading astral character occupies two UTF-16 code units.
      const length = (line.text.codePointAt(0) ?? 0) > 0xffff ? 2 : 1;
      report(displayRange(manuscript, line.start, line.start + length));
    }
  });
}

export const paragraphLeadingCharacterRule = (): ParsedProofreadingRule =>
  build(DEFAULT_ALLOWED_CHARACTERS);

export function createParagraphLeadingCharacterRule(
  options: ParagraphLeadingCharacterOptions = {},
): ManuscriptResult<ParsedProofreadingRule, InvalidRuleOptions> {
  if (options.allowedCharacters === undefined) {
    return ManuscriptResult.succeed(paragraphLeadingCharacterRule());
  }

  const allowed = v.safeParse(AllowedCharactersSchema, options.allowedCharacters);
  if (!allowed.success) {
    return ManuscriptResult.fail({
      kind: "InvalidRuleOptions",
      ruleId: RULE_ID,
      option: "allowedCharacters",
      issues: ValidationIssue.from(allowed.issues),
    });
  }

  return ManuscriptResult.succeed(build(allowed.output));
}
