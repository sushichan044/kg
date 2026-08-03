import type { ValidationIssue } from "../result/validation-issue";

/**
 * A built-in rule factory was given options it cannot honour. Distinct from {@link ProofreadError}
 * because it happens while configuring rules, long before any manuscript is checked.
 */
export type InvalidRuleOptions = Readonly<{
  kind: "InvalidRuleOptions";
  ruleId: string;
  option: string;
  issues: readonly ValidationIssue[];
}>;

export const InvalidRuleOptions = {
  describe: (error: InvalidRuleOptions): string =>
    `ルール ${error.ruleId} のオプション "${error.option}" が不正です: ${error.issues
      .map(({ message }) => message)
      .join(", ")}`,
} as const;
