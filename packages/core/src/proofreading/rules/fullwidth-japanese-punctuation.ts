import type { DiagnosticSeverity } from "../../diagnostic/diagnostic-severity";
import type { ParsedProofreadingRule } from "../proofreading-rule";
import { splitDisplayLines } from "./internal/display-line";
import { displayRange } from "./internal/rule-range";

const RULE_ID = "kg/fullwidth-japanese-punctuation";

const MESSAGES = {
  "halfwidth-japanese-punctuation":
    "半角の「{{ character }}」があります。日本語の句読点・括弧・感嘆符・疑問符は全角にしてください",
  "halfwidth-near-japanese":
    "日本語の前後に半角の「{{ character }}」があります。全角にすべきか確認してください",
} as const;

const JAPANESE_CHARACTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ヵヶ]/u;

type PunctuationCheck = Readonly<{
  pattern: RegExp;
  messageId: keyof typeof MESSAGES;
  severity: DiagnosticSeverity;
  /**
   * Whether a neighbouring Japanese character is what makes the halfwidth form wrong.
   */
  requiresJapanese: boolean;
}>;

const CHECKS: readonly PunctuationCheck[] = [
  {
    // Halfwidth forms that exist only as Japanese punctuation, so their presence is decisive.
    pattern: /[｡､｢｣]/gu,
    messageId: "halfwidth-japanese-punctuation",
    severity: "error",
    requiresJapanese: false,
  },
  {
    // Correct in Latin text and wrong in Japanese prose, so `Hello!` has to survive.
    pattern: /[!?]/gu,
    messageId: "halfwidth-japanese-punctuation",
    severity: "error",
    requiresJapanese: true,
  },
  {
    // Whether these belong in fullwidth at all is the author's call, so this only asks.
    pattern: /[,.()[\]{}]/gu,
    messageId: "halfwidth-near-japanese",
    severity: "warning",
    requiresJapanese: true,
  },
];

function isBesideJapanese(text: string, index: number): boolean {
  const before = text[index - 1];
  const after = text[index + 1];

  return (
    (before !== undefined && JAPANESE_CHARACTER.test(before)) ||
    (after !== undefined && JAPANESE_CHARACTER.test(after))
  );
}

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

export const fullwidthJapanesePunctuationRule = (): ParsedProofreadingRule => ({
  kind: "parsed",
  meta: { id: RULE_ID, messages: MESSAGES },
  check: (manuscript, context) => {
    for (const line of splitDisplayLines(manuscript.displayText)) {
      for (const { pattern, messageId, severity, requiresJapanese } of CHECKS) {
        for (const match of line.text.matchAll(pattern)) {
          if (requiresJapanese && !isBesideJapanese(line.text, match.index)) continue;
          if (isEllipsisSubstitute(line.text, match.index)) continue;

          const start = line.start + match.index;
          context.report({
            range: displayRange(manuscript, start, start + match[0].length),
            messageId,
            data: { character: match[0] },
            severity,
          });
        }
      }
    }
  },
});
