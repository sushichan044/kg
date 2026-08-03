import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

export const spaceAfterQuestionOrExclamationRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/space-after-question-or-exclamation",
    pattern: /[？！](?![ 　？！」』〗〉》）)”"’'］\]〕｝}＞>]|$)/gu,
    message: "感嘆符または疑問符の直後には空白か閉じ括弧が必要です",
  });
