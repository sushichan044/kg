import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineProofreadingRule } from "../proofreading-rule-definition";
import { splitDisplayLines } from "./internal/display-line";
import { isBesideJapanese } from "./internal/japanese-text";
import { displayRange } from "./internal/rule-range";

const RULE_ID = "kg/halfwidth-punctuation-near-japanese";

const MESSAGE = "日本語の前後に半角の「{{ character }}」があります。全角にすべきか確認してください";

// Whether these belong in fullwidth at all is the author's call, so this only asks.
const PATTERN = /[,.()[\]{}]/gu;

/**
 * A period inside a run of three or more is a stand-in for `…`, which `kg/ellipsis-character`
 * already reports.
 */
function isEllipsisSubstitute(text: string, index: number): boolean {
  if (text[index] !== ".") return false;

  let start = index;
  while (text[start - 1] === ".") start -= 1;
  let end = index;
  while (text[end + 1] === ".") end += 1;

  return end - start + 1 >= 3;
}

/**
 * Whether halfwidth `,.()[]{}` belong beside Japanese prose is a heuristic, not a rule: `本文(注)` is
 * common in practice, so this is a warning a caller can turn off independently of
 * `kg/fullwidth-japanese-punctuation`'s harder findings.
 */
function build(): ParsedProofreadingRule {
  return {
    kind: "parsed",
    meta: { id: RULE_ID, messages: { default: MESSAGE } },
    check: (manuscript, context) => {
      for (const line of splitDisplayLines(manuscript.displayText)) {
        for (const match of line.text.matchAll(PATTERN)) {
          if (!isBesideJapanese(line.text, match.index)) continue;
          if (isEllipsisSubstitute(line.text, match.index)) continue;

          const start = line.start + match.index;
          context.report({
            range: displayRange(manuscript, start, start + match[0].length),
            messageId: "default",
            data: { character: match[0] },
            severity: "warning",
          });
        }
      }
    },
  };
}

export const halfwidthPunctuationNearJapaneseRuleDefinition = defineProofreadingRule({
  id: RULE_ID,
  create: build,
});
