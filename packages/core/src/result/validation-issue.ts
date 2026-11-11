import * as v from "valibot";

import { readonlyObject } from "../internal/schema";

const ValidationIssueSchema = readonlyObject({
  path: v.string(),
  message: v.string(),
});

/**
 * スキーマ違反 1 件。呼び出し側が対処に使う「どこで起きたか」と「何が誤っていたか」の 2 点だけに
 * 絞る。独自の形にしておくことで、検証ライブラリは実装の詳細にとどまる。
 */
export type ValidationIssue = v.InferOutput<typeof ValidationIssueSchema>;

export const ValidationIssue = {
  schema: ValidationIssueSchema,

  from: (issues: ReadonlyArray<v.BaseIssue<unknown>>): readonly ValidationIssue[] =>
    issues.map((issue) => ({
      path: (issue.path ?? []).map((item) => String(item.key)).join("."),
      message: issue.message,
    })),
} as const;
