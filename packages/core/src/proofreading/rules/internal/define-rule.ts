import type { ParsedManuscript } from "../../../parser/parsed-manuscript";
import type { ManuscriptRange } from "../../../range/manuscript-range";
import type { ProofreadingReport } from "../../proofreading-report";
import type { ParsedProofreadingRule } from "../../proofreading-rule";
import { splitDisplayLines } from "./display-line";
import { displayRange } from "./rule-range";

const DEFAULT_MESSAGE_ID = "default";

/**
 * 単一メッセージのルールが、報告する範囲のほかに、指摘ごとに変えられるもの。
 */
type ReportOptions = Pick<ProofreadingReport, "data" | "severity">;

/**
 * 単一メッセージのルールを作る。本体が範囲を報告し、ラッパーがメッセージを名付ける。
 */
export function defineParsedRule(
  id: string,
  message: string,
  check: (
    manuscript: ParsedManuscript,
    report: (range: ManuscriptRange, options?: ReportOptions) => void,
  ) => void,
): ParsedProofreadingRule {
  return {
    kind: "parsed",
    meta: { id, messages: { [DEFAULT_MESSAGE_ID]: message } },
    check: (manuscript, context) => {
      check(manuscript, (range, options) => {
        context.report({ ...options, range, messageId: DEFAULT_MESSAGE_ID });
      });
    },
  };
}

type MatchRuleOptions = Readonly<{
  id: string;
  pattern: RegExp;
  message: string;
  /**
   * 構文上の一致を、実際の違反に絞り込む。一致したものを数えるルール向け。
   */
  accept?: (match: RegExpExecArray) => boolean;
}>;

/**
 * 各表示行をスティッキーパターンで走査するルールを作る。
 * テキスト全体ではなく行ごとに照合することで、指摘が改行をまたがなくなる。
 */
export function defineMatchRule(options: MatchRuleOptions): ParsedProofreadingRule {
  return defineParsedRule(options.id, options.message, (manuscript, report) => {
    for (const line of splitDisplayLines(manuscript.displayText)) {
      options.pattern.lastIndex = 0;
      let match = options.pattern.exec(line.text);
      while (match !== null) {
        if (options.accept?.(match) ?? true) {
          const start = line.start + match.index;
          report(displayRange(manuscript, start, start + match[0].length));
        }
        match = options.pattern.exec(line.text);
      }
    }
  });
}
