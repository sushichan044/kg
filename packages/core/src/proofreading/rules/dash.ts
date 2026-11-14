import * as v from "valibot";

import { ManuscriptResult } from "../../result/manuscript-result";
import { ValidationIssue } from "../../result/validation-issue";
import type { InvalidRuleOptions } from "../invalid-rule-options";
import type { ParsedProofreadingRule } from "../proofreading-rule";
import { splitDisplayLines } from "./internal/display-line";
import { displayRange } from "./internal/rule-range";

const RULE_ID = "kg/dash";
const DEFAULT_PREFERRED = "―";
const DASH_CHARACTERS = ["―", "—", "─"] as const;
const DashCharacterSchema = v.picklist(DASH_CHARACTERS);
const DASH_LIKE_RUN = /[—–―─━﹣－-]+/gu;

type DashCharacter = v.InferOutput<typeof DashCharacterSchema>;
type DashMessageId = "character" | "even-count";

type DashOptions = Readonly<{ preferred?: DashCharacter }>;

const EVEN_COUNT_MESSAGE = "連続するダッシュの数は偶数にしてください";

function messageIdFor(run: string, preferred: DashCharacter): DashMessageId | undefined {
  if (run === "-") return undefined;
  if (run !== preferred.repeat(run.length)) return "character";

  return run.length % 2 === 1 ? "even-count" : undefined;
}

/**
 * 小説が組むダッシュは 2倍ダッシュ、すなわち同じ文字を 2 つ並べて、
 * 全角 2 つ分の長さの 1 本の罫線として読ませるものである。
 * 奇数個の連なりが指摘になるのはそのためで、半分が余る。
 * 文字が一致しなければならないのも同じ理由で、同じ文字の繰り返しだけが継ぎ目なくつながる。
 * JLReq がダッシュを分離禁止文字（cl-08）に分類するのも同じ理由による。
 * 対を行の途中で分割してはならない。
 */
function build(preferred: DashCharacter): ParsedProofreadingRule {
  const messages = {
    character: `ダッシュには「${preferred}」を使ってください`,
    "even-count": EVEN_COUNT_MESSAGE,
  } as const;

  return {
    kind: "parsed",
    meta: { id: RULE_ID, messages },
    check: (manuscript, context) => {
      for (const line of splitDisplayLines(manuscript.displayText)) {
        DASH_LIKE_RUN.lastIndex = 0;
        let match = DASH_LIKE_RUN.exec(line.text);

        while (match !== null) {
          const run = match[0];
          const messageId = messageIdFor(run, preferred);

          if (messageId !== undefined) {
            const start = line.start + match.index;
            context.report({
              range: displayRange(manuscript, start, start + run.length),
              messageId,
            });
          }

          match = DASH_LIKE_RUN.exec(line.text);
        }
      }
    },
  };
}

export const dashRule = (): ParsedProofreadingRule => build(DEFAULT_PREFERRED);

/**
 * @internal
 */
export function createDashRule(
  options: DashOptions = {},
): ManuscriptResult<ParsedProofreadingRule, InvalidRuleOptions> {
  if (options.preferred === undefined) {
    return ManuscriptResult.succeed(dashRule());
  }

  const preferred = v.safeParse(DashCharacterSchema, options.preferred);
  if (!preferred.success) {
    return ManuscriptResult.fail({
      kind: "InvalidRuleOptions",
      ruleId: RULE_ID,
      option: "preferred",
      issues: ValidationIssue.from(preferred.issues),
    });
  }

  return ManuscriptResult.succeed(build(preferred.output));
}
