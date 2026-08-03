import { assertNever } from "../assert-never";
import { describeCause } from "../internal/describe-cause";
import type { NamespacedId } from "../namespaced-id";
import type { ValidationIssue } from "../result/validation-issue";

/**
 * Everything that can go wrong while running a set of rules over a manuscript.
 */
export type ProofreadError =
  | Readonly<{ kind: "InvalidRuleId"; ruleId: string }>
  | Readonly<{ kind: "DuplicateRuleId"; ruleId: NamespacedId }>
  | Readonly<{
      kind: "InvalidRuleMetadata";
      ruleId: NamespacedId;
      issues: readonly ValidationIssue[];
    }>
  | Readonly<{ kind: "InvalidReport"; ruleId: NamespacedId; issues: readonly ValidationIssue[] }>
  | Readonly<{ kind: "UnknownMessageId"; ruleId: NamespacedId; messageId: string }>
  | Readonly<{ kind: "RuleThrew"; ruleId: NamespacedId; cause: unknown }>;

export const ProofreadError = {
  /**
   * Human-readable rendering. Branch on `kind` instead when the caller needs to react.
   */
  describe: (error: ProofreadError): string => {
    switch (error.kind) {
      case "InvalidRuleId": {
        return `ルール ID "${error.ruleId}" は namespace/name の形式ではありません`;
      }
      case "DuplicateRuleId": {
        return `ルール ID ${error.ruleId} が重複しています`;
      }
      case "InvalidRuleMetadata": {
        return `ルール ${error.ruleId} の metadata が不正です: ${joinIssues(error.issues)}`;
      }
      case "InvalidReport": {
        return `ルール ${error.ruleId} の報告が契約を満たしていません: ${joinIssues(error.issues)}`;
      }
      case "UnknownMessageId": {
        return `ルール ${error.ruleId} が未宣言のメッセージ ID "${error.messageId}" を報告しました`;
      }
      case "RuleThrew": {
        return `ルール ${error.ruleId} が例外を投げました: ${describeCause(error.cause)}`;
      }
      default: {
        return assertNever(error);
      }
    }
  },
} as const;

function joinIssues(issues: readonly ValidationIssue[]): string {
  return issues.map(({ message }) => message).join(", ");
}
