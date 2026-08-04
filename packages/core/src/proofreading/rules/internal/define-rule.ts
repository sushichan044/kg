import type { ParsedManuscript } from "../../../parser/parsed-manuscript";
import type { ManuscriptRange } from "../../../range/manuscript-range";
import type { ProofreadingReport } from "../../proofreading-report";
import type { ParsedProofreadingRule } from "../../proofreading-rule";
import { splitDisplayLines } from "./display-line";
import { displayRange } from "./rule-range";

const DEFAULT_MESSAGE_ID = "default";

/**
 * What a single-message rule may vary per finding, beyond the range it reports.
 */
export type ReportOptions = Pick<ProofreadingReport, "data" | "severity">;

/**
 * Builds a single-message rule; the body reports ranges and the wrapper names the message.
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

export type MatchRuleOptions = Readonly<{
  id: string;
  pattern: RegExp;
  message: string;
  /**
   * Narrows a syntactic match to an actual violation, for rules that count what they matched.
   */
  accept?: (match: RegExpExecArray) => boolean;
}>;

/**
 * Builds a rule that scans each display line with a sticky pattern. Matching per line rather than
 * across the whole text keeps findings from spanning a line break.
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
