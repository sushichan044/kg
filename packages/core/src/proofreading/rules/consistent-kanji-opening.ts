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
  // 同じ表記は組にならない。
  // ルールが一方に対してもう一方を見つけてしまい、常に警告することになるからである。
  v.check(({ closed, opened }) => closed !== opened, "a pair must hold two different spellings"),
);

/**
 * 1 つの語の 2 通りの表記。`出来る` と `できる` など。日本語の編集では、
 * 2 つの形ではなく 2 つの選択に名前を付ける。語を漢字で書くのが閉じる、かなで書くのが開くであり、
 * フィールド名はここに由来する。どちらを好むかは作品ごとのハウススタイルだが、
 * 1 つの作品の中で両方を使うのは表記ゆれである。
 */
type KanjiOpeningPair = v.InferOutput<typeof KanjiOpeningPairSchema>;

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

type ConsistentKanjiOpeningOptions = Readonly<{ pairs?: readonly KanjiOpeningPair[] }>;

/**
 * 原稿がかなでも書いている組すべてについて、漢字表記の最初の出現を報告する。
 * 2 つの表記が意図した使い分けかどうかは作者が判断することなので、指摘は警告とする。
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

/**
 * @internal
 */
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
