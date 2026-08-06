import { assertNever } from "../assert-never";
import type { ValidationIssue } from "../result/validation-issue";

/**
 * Everything that can go wrong while resolving a {@link ProofreadingConfig} into rule instances.
 * Distinct from {@link ProofreadError} because it happens while configuring rules, long before any
 * manuscript is checked.
 */
export type ProofreadingConfigError =
  | Readonly<{ kind: "InvalidConfig"; issues: readonly ValidationIssue[] }>
  | Readonly<{ kind: "UnknownRuleId"; ruleId: string }>
  | Readonly<{ kind: "UnexpectedRuleOptions"; ruleId: string }>
  | Readonly<{ kind: "InvalidRuleOptions"; ruleId: string; issues: readonly ValidationIssue[] }>;

export const ProofreadingConfigError = {
  /**
   * Human-readable rendering. Branch on `kind` instead when the caller needs to react.
   */
  describe: (error: ProofreadingConfigError): string => {
    switch (error.kind) {
      case "InvalidConfig": {
        return `校正の config が不正です: ${joinIssues(error.issues)}`;
      }
      case "UnknownRuleId": {
        return `ルール ID "${error.ruleId}" は組み込みルールに存在しません`;
      }
      case "UnexpectedRuleOptions": {
        return `ルール ${error.ruleId} は options を受け付けません`;
      }
      case "InvalidRuleOptions": {
        return `ルール ${error.ruleId} の options が不正です: ${joinIssues(error.issues)}`;
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
