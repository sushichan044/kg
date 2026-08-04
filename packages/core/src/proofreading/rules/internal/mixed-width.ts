import type { ParsedProofreadingRule } from "../../proofreading-rule";
import { defineParsedRule } from "./define-rule";
import { displayRange } from "./rule-range";

export type MixedWidthRuleOptions = Readonly<{
  id: string;
  message: string;
  /**
   * Both patterns must be non-global: the rule only ever asks for a first occurrence.
   */
  halfwidth: RegExp;
  fullwidth: RegExp;
}>;

/**
 * Builds a rule that fires when a manuscript uses both widths of one character class. Which width
 * is right is the author's decision, so the finding is a warning, and one finding at the first
 * halfwidth occurrence says everything a list of every mixed character would.
 */
export function defineMixedWidthRule({
  id,
  message,
  halfwidth,
  fullwidth,
}: MixedWidthRuleOptions): ParsedProofreadingRule {
  return defineParsedRule(id, message, (manuscript, report) => {
    const found = halfwidth.exec(manuscript.displayText);
    const counterpart = fullwidth.exec(manuscript.displayText);
    if (found === null || counterpart === null) return;

    report(displayRange(manuscript, found.index, found.index + found[0].length), {
      data: { halfwidth: found[0], fullwidth: counterpart[0] },
      severity: "warning",
    });
  });
}
