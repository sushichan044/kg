import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineProofreadingRule } from "../proofreading-rule-definition";
import { splitDisplayLines } from "./internal/display-line";
import { isBesideJapanese } from "./internal/japanese-text";
import { displayRange } from "./internal/rule-range";

const RULE_ID = "kg/fullwidth-japanese-punctuation";

const MESSAGE =
  "半角の「{{ character }}」があります。日本語の句読点・括弧・感嘆符・疑問符は全角にしてください";

type PunctuationCheck = Readonly<{
  pattern: RegExp;
  /**
   * Whether a neighbouring Japanese character is what makes the halfwidth form wrong.
   */
  requiresJapanese: boolean;
}>;

const CHECKS: readonly PunctuationCheck[] = [
  {
    // Halfwidth forms that exist only as Japanese punctuation, so their presence is decisive.
    pattern: /[｡､｢｣]/gu,
    requiresJapanese: false,
  },
  {
    // Correct in Latin text and wrong in Japanese prose, so `Hello!` has to survive.
    pattern: /[!?]/gu,
    requiresJapanese: true,
  },
];

/**
 * Halfwidth marks that only ever mean Japanese punctuation, plus `!` and `?` beside Japanese prose.
 * Whether halfwidth `,.()[]{}` belong beside Japanese is a softer, heuristic call, and is reported
 * separately by `kg/halfwidth-punctuation-near-japanese` so a caller can silence it alone.
 */
function build(): ParsedProofreadingRule {
  return {
    kind: "parsed",
    meta: { id: RULE_ID, messages: { default: MESSAGE } },
    check: (manuscript, context) => {
      for (const line of splitDisplayLines(manuscript.displayText)) {
        for (const { pattern, requiresJapanese } of CHECKS) {
          for (const match of line.text.matchAll(pattern)) {
            if (requiresJapanese && !isBesideJapanese(line.text, match.index)) continue;

            const start = line.start + match.index;
            context.report({
              range: displayRange(manuscript, start, start + match[0].length),
              messageId: "default",
              data: { character: match[0] },
            });
          }
        }
      }
    },
  };
}

export const fullwidthJapanesePunctuationRuleDefinition = defineProofreadingRule({
  id: RULE_ID,
  create: build,
});
