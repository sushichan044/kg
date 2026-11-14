import type { ParsedProofreadingRule } from "../../proofreading-rule";
import { defineParsedRule } from "./define-rule";
import { displayRange } from "./rule-range";

type MixedWidthRuleOptions = Readonly<{
  id: string;
  message: string;
  /**
   * 両方のパターンは非グローバルでなければならない。ルールが求めるのは最初の出現だけだからである。
   */
  halfwidth: RegExp;
  fullwidth: RegExp;
}>;

/**
 * 1 つの文字クラスの両方の幅を、原稿が使っているときに指摘するルールを作る。
 * どちらの幅が正しいかは作者が決めることなので、指摘は警告とする。
 * 最初の半角の出現に対する 1 件の指摘で、混在した文字をすべて列挙した一覧と同じことが伝わる。
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
