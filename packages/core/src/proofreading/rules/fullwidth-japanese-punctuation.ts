import type { ParsedProofreadingRule } from "../proofreading-rule";
import { splitDisplayLines } from "./internal/display-line";
import { displayRange } from "./internal/rule-range";

const RULE_ID = "kg/fullwidth-japanese-punctuation";

const MESSAGES = {
  "halfwidth-kana-punctuation":
    "半角の「{{ character }}」があります。日本語の句読点・括弧・感嘆符・疑問符は全角にしてください",
  "halfwidth-near-japanese":
    "日本語の前後に半角の「{{ character }}」があります。全角にすべきか確認してください",
} as const;

/**
 * Halfwidth forms that only exist as Japanese punctuation, so their presence is decisive.
 */
const KANA_PUNCTUATION = /[｡､｢｣!?]/gu;

/**
 * Halfwidth forms that are correct in Latin text, and suspect only next to Japanese.
 */
const SHARED_PUNCTUATION = /[,.()[\]{}]/gu;

const JAPANESE_CHARACTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ヵヶ]/u;

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
    const report = (
      line: Readonly<{ start: number }>,
      index: number,
      character: string,
      messageId: keyof typeof MESSAGES,
    ) => {
      context.report({
        range: displayRange(manuscript, line.start + index, line.start + index + character.length),
        messageId,
        data: { character },
        severity: messageId === "halfwidth-near-japanese" ? "warning" : "error",
      });
    };

    for (const line of splitDisplayLines(manuscript.displayText)) {
      for (const match of line.text.matchAll(KANA_PUNCTUATION)) {
        report(line, match.index, match[0], "halfwidth-kana-punctuation");
      }

      for (const match of line.text.matchAll(SHARED_PUNCTUATION)) {
        if (!isBesideJapanese(line.text, match.index)) continue;
        if (isEllipsisSubstitute(line.text, match.index)) continue;

        report(line, match.index, match[0], "halfwidth-near-japanese");
      }
    }
  },
});
