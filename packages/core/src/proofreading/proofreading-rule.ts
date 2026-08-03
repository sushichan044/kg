import * as v from "valibot";

import type { ComposedManuscript } from "../composer/composed-manuscript";
import { readonlyObject } from "../internal/schema";
import type { ParsedManuscript } from "../parser/parsed-manuscript";
import type { ProofreadingRuleContext } from "./proofreading-rule-context";

const ProofreadingRuleMessagesSchema = v.pipe(v.record(v.string(), v.string()), v.readonly());

/**
 * Message templates the rule can name in a report, keyed by message ID.
 */
export type ProofreadingRuleMessages = v.InferOutput<typeof ProofreadingRuleMessagesSchema>;

const ProofreadingRuleMetaSchema = readonlyObject({
  id: v.string(),
  messages: ProofreadingRuleMessagesSchema,
});

export type ProofreadingRuleMeta = v.InferOutput<typeof ProofreadingRuleMetaSchema>;

export const ProofreadingRuleMeta = {
  schema: ProofreadingRuleMetaSchema,
  messagesSchema: ProofreadingRuleMessagesSchema,
} as const;

/**
 * A rule that only needs the parsed manuscript. The `kind` sits on the rule itself, not inside
 * `meta`, so the runner narrows to the right `check` signature without a cast.
 */
export type ParsedProofreadingRule = Readonly<{
  kind: "parsed";
  meta: ProofreadingRuleMeta;
  check: (manuscript: ParsedManuscript, context: ProofreadingRuleContext) => void;
}>;

/**
 * A rule that needs the composed manuscript, for findings that depend on placement.
 */
export type ComposedProofreadingRule<TComposed extends ComposedManuscript = ComposedManuscript> =
  Readonly<{
    kind: "composed";
    meta: ProofreadingRuleMeta;
    check: (manuscript: TComposed, context: ProofreadingRuleContext) => void;
  }>;

export type ProofreadingRule = ParsedProofreadingRule | ComposedProofreadingRule;
