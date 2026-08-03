import * as v from "valibot";

import { readonlyObject } from "../internal/schema";

const ValidationIssueSchema = readonlyObject({
  path: v.string(),
  message: v.string(),
});

/**
 * One schema violation, reduced to the two things a caller acts on: where it happened and what was
 * wrong. Keeping our own shape means the validation library stays an implementation detail.
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
