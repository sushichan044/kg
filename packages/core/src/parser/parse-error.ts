import { assertNever } from "../internal/assert-never";
import { describeCause } from "../internal/describe-cause";
import type { NamespacedId } from "../namespaced-id";
import type { ValidationIssue } from "../result/validation-issue";

/**
 * ソーステキストを {@link ParsedManuscript} に変換する間に起こりうるすべての失敗。
 */
export type ParseError =
  | Readonly<{ kind: "InvalidParserId"; parserId: string }>
  | Readonly<{
      kind: "InvalidParserOutput";
      parserId: NamespacedId;
      issues: readonly ValidationIssue[];
    }>
  | Readonly<{ kind: "ParserRejected"; parserId: NamespacedId; reason: string }>
  | Readonly<{ kind: "ParserThrew"; parserId: NamespacedId; cause: unknown }>;

export const ParseError = {
  /**
   * 人が読める形の文字列。呼び出し側が処理を分けたい場合は、代わりに `kind` で分岐する。
   */
  describe: (error: ParseError): string => {
    switch (error.kind) {
      case "InvalidParserId": {
        return `パーサー ID "${error.parserId}" は namespace/name の形式ではありません`;
      }
      case "InvalidParserOutput": {
        return `パーサー ${error.parserId} の出力が契約を満たしていません: ${error.issues
          .map(({ message }) => message)
          .join(", ")}`;
      }
      case "ParserRejected": {
        return `パーサー ${error.parserId} が解析を中止しました: ${error.reason}`;
      }
      case "ParserThrew": {
        return `パーサー ${error.parserId} が例外を投げました: ${describeCause(error.cause)}`;
      }
      default: {
        return assertNever(error);
      }
    }
  },
} as const;
