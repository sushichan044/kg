import * as v from "valibot";

import { readonlyObject } from "../../internal/schema";
import { ManuscriptResult } from "../../result/manuscript-result";
import { ValidationIssue } from "../../result/validation-issue";
import type { InvalidRuleOptions } from "../invalid-rule-options";
import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineParsedRule } from "./internal/define-rule";
import { displayRange } from "./internal/rule-range";

const RULE_ID = "kg/consistent-kanji-opening";
const MESSAGE =
  "「{{ closed }}」と「{{ opened }}」が混在しています。文脈上の使い分けか表記ゆれかを確認してください";

const KanjiOpeningPairSchema = v.pipe(
  readonlyObject({
    closed: v.pipe(v.string(), v.nonEmpty()),
    opened: v.pipe(v.string(), v.nonEmpty()),
  }),
  // Identical spellings are not a pair: the rule would find one for the other and always warn.
  v.check(({ closed, opened }) => closed !== opened, "a pair must hold two different spellings"),
);

/**
 * A word written in kanji, paired with the kana form of the same word.
 */
export type KanjiOpeningPair = v.InferOutput<typeof KanjiOpeningPairSchema>;

const PairsSchema = v.pipe(v.array(KanjiOpeningPairSchema), v.nonEmpty(), v.readonly());

const DEFAULT_PAIRS: readonly KanjiOpeningPair[] = [
  { closed: "出来る", opened: "できる" },
  { closed: "出来ない", opened: "できない" },
  { closed: "下さい", opened: "ください" },
  { closed: "頂く", opened: "いただく" },
  { closed: "致す", opened: "いたす" },
  { closed: "何故", opened: "なぜ" },
  { closed: "為に", opened: "ために" },
  { closed: "時に", opened: "ときに" },
  { closed: "様に", opened: "ように" },
  { closed: "方が", opened: "ほうが" },
];

export type ConsistentKanjiOpeningOptions = Readonly<{ pairs?: readonly KanjiOpeningPair[] }>;

/**
 * Reports the first kanji occurrence of every pair the manuscript also writes in kana. Whether the
 * two spellings are a deliberate distinction is the author's call, so the finding is a warning.
 */
function build(pairs: readonly KanjiOpeningPair[]): ParsedProofreadingRule {
  return defineParsedRule(RULE_ID, MESSAGE, (manuscript, report) => {
    for (const { closed, opened } of pairs) {
      if (!manuscript.displayText.includes(opened)) continue;

      const index = manuscript.displayText.indexOf(closed);
      if (index === -1) continue;

      report(displayRange(manuscript, index, index + closed.length), {
        data: { closed, opened },
        severity: "warning",
      });
    }
  });
}

export const consistentKanjiOpeningRule = (): ParsedProofreadingRule => build(DEFAULT_PAIRS);

export function createConsistentKanjiOpeningRule(
  options: ConsistentKanjiOpeningOptions = {},
): ManuscriptResult<ParsedProofreadingRule, InvalidRuleOptions> {
  if (options.pairs === undefined) {
    return ManuscriptResult.succeed(consistentKanjiOpeningRule());
  }

  const pairs = v.safeParse(PairsSchema, options.pairs);
  if (!pairs.success) {
    return ManuscriptResult.fail({
      kind: "InvalidRuleOptions",
      ruleId: RULE_ID,
      option: "pairs",
      issues: ValidationIssue.from(pairs.issues),
    });
  }

  return ManuscriptResult.succeed(build(pairs.output));
}
