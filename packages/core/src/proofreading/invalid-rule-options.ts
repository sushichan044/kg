import type { ValidationIssue } from "../result/validation-issue";

/**
 * 組み込みルールのファクトリーに、受け付けられないオプションが渡された。
 * {@link ProofreadError} と別にするのは、これが原稿をチェックするよりずっと前、
 * ルールを構成する時点で起こるためである。
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
