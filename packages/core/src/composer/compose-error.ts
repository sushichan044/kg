import { assertNever } from "../assert-never";
import { describeCause } from "../internal/describe-cause";
import type { NamespacedId } from "../namespaced-id";
import type { ValidationIssue } from "../result/validation-issue";

/**
 * Everything that can go wrong while placing a parsed manuscript onto pages.
 */
export type ComposeError =
  | Readonly<{ kind: "InvalidComposerId"; composerId: string }>
  | Readonly<{ kind: "InvalidManuscript"; issues: readonly ValidationIssue[] }>
  | Readonly<{
      kind: "InvalidSettings";
      composerId: NamespacedId;
      issues: readonly ValidationIssue[];
    }>
  | Readonly<{
      kind: "InvalidComposerOutput";
      composerId: NamespacedId;
      issues: readonly ValidationIssue[];
    }>
  | Readonly<{ kind: "ComposerRejected"; composerId: NamespacedId; reason: string }>
  | Readonly<{ kind: "ComposerThrew"; composerId: NamespacedId; cause: unknown }>;

export const ComposeError = {
  /**
   * Human-readable rendering. Branch on `kind` instead when the caller needs to react.
   */
  describe: (error: ComposeError): string => {
    switch (error.kind) {
      case "InvalidComposerId": {
        return `組版エンジン ID "${error.composerId}" は namespace/name の形式ではありません`;
      }
      case "InvalidManuscript": {
        return `解析済み原稿が不正です: ${joinIssues(error.issues)}`;
      }
      case "InvalidSettings": {
        return `組版設定が ${error.composerId} の要求を満たしていません: ${joinIssues(error.issues)}`;
      }
      case "InvalidComposerOutput": {
        return `組版エンジン ${error.composerId} の出力が契約を満たしていません: ${joinIssues(error.issues)}`;
      }
      case "ComposerRejected": {
        return `組版エンジン ${error.composerId} が組版を中止しました: ${error.reason}`;
      }
      case "ComposerThrew": {
        return `組版エンジン ${error.composerId} が例外を投げました: ${describeCause(error.cause)}`;
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
