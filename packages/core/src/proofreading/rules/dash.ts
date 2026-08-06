import * as v from "valibot";

import { readonlyObject } from "../../internal/schema";
import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineProofreadingRule } from "../proofreading-rule-definition";
import { splitDisplayLines } from "./internal/display-line";
import { displayRange } from "./internal/rule-range";

const RULE_ID = "kg/dash";
const DEFAULT_PREFERRED = "―";
const DASH_CHARACTERS = ["―", "—", "─"] as const;
const DashCharacterSchema = v.picklist(DASH_CHARACTERS);
const DASH_LIKE_RUN = /[—–―─━﹣－-]+/gu;

type DashCharacter = v.InferOutput<typeof DashCharacterSchema>;
type DashMessageId = "character" | "even-count";

const DashOptionsSchema = readonlyObject({
  preferred: v.optional(DashCharacterSchema, DEFAULT_PREFERRED),
});

const EVEN_COUNT_MESSAGE = "連続するダッシュの数は偶数にしてください";

function messageIdFor(run: string, preferred: DashCharacter): DashMessageId | undefined {
  if (run === "-") return undefined;
  if (run !== preferred.repeat(run.length)) return "character";

  return run.length % 2 === 1 ? "even-count" : undefined;
}

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

export const dashRuleDefinition = defineProofreadingRule({
  id: RULE_ID,
  optionsSchema: v.optional(DashOptionsSchema, {}),
  create: ({ preferred }) => build(preferred),
});
