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
   * 隣接する和文の文字が、半角形を誤りにしているかどうか。
   */
  requiresJapanese: boolean;
}>;

const CHECKS: readonly PunctuationCheck[] = [
  {
    // 和文の約物としてしか存在しない半角形。したがって、存在そのものが決め手になる。
    pattern: /[｡､｢｣]/gu,
    messageId: "halfwidth-japanese-punctuation",
    severity: "error",
    requiresJapanese: false,
  },
  {
    // 欧文では正しく和文では誤りなので、`Hello!` は残さなければならない。
    pattern: /[!?]/gu,
    messageId: "halfwidth-japanese-punctuation",
    severity: "error",
    requiresJapanese: true,
  },
  {
    // これらを全角にすべきかどうか自体が作者の判断なので、ここでは問うだけにする。
    pattern: /[,.()[\]{}]/gu,
    messageId: "halfwidth-near-japanese",
    severity: "warning",
    requiresJapanese: true,
  },
];

function isBesideJapanese(text: string, start: number, end: number): boolean {
  const before = codePointBefore(text, start);
  const after = text.codePointAt(end);

  return (
    (before !== undefined && JAPANESE_CHARACTER.test(before)) ||
    (after !== undefined && JAPANESE_CHARACTER.test(String.fromCodePoint(after)))
  );
}

function codePointBefore(text: string, index: number): string | undefined {
  if (index <= 0) return undefined;

  const low = text.charCodeAt(index - 1);
  const high = index >= 2 ? text.charCodeAt(index - 2) : 0;
  const isPair = low >= 0xdc00 && low <= 0xdfff && high >= 0xd800 && high <= 0xdbff;

  return text.slice(isPair ? index - 2 : index - 1, index);
}

/**
 * 3 つ以上の連なりの中のピリオドは `…` の代用であり、
 * `kg/ellipsis-character` がすでに報告している。
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
 * 和文が全角形を求める場面での半角の約物。和文の約物は全角で設計されており、
 * コンポーザーのアキの規則もその前提で書かれている。そのため、半角形は、グリッドに乗らず、
 * その文字クラスが求めるアキも付かない。
 *
 * 3 つのチェックは、周囲がどれだけ答えを左右するかが異なる。
 * 最初のものだけが単独で決め手になるのはそのためである。
 */
export const fullwidthJapanesePunctuationRule = (): ParsedProofreadingRule => ({
  kind: "parsed",
  meta: { id: RULE_ID, messages: MESSAGES },
  check: (manuscript, context) => {
    for (const line of splitDisplayLines(manuscript.displayText)) {
      for (const { pattern, messageId, severity, requiresJapanese } of CHECKS) {
        for (const match of line.text.matchAll(pattern)) {
          if (
            requiresJapanese &&
            !isBesideJapanese(line.text, match.index, match.index + match[0].length)
          )
            continue;
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
