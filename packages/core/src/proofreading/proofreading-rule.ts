import * as v from "valibot";

import type { ComposedManuscript } from "../composer/composed-manuscript";
import { readonlyObject } from "../internal/schema";
import type { ParsedManuscript } from "../parser/parsed-manuscript";
import type { ProofreadingRuleContext } from "./proofreading-rule-context";

const ProofreadingRuleMessagesSchema = v.pipe(v.record(v.string(), v.string()), v.readonly());

/**
 * ルールが報告で名前を挙げられるメッセージテンプレート。メッセージ ID をキーとする。
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
 * パース済みの原稿だけを必要とするルール。`kind` は `meta` の中ではなくルール自体に置く。
 * これにより、ランナーはキャストなしで正しい `check` のシグネチャに絞り込める。
 */
export type ParsedProofreadingRule = Readonly<{
  kind: "parsed";
  meta: ProofreadingRuleMeta;
  check: (manuscript: ParsedManuscript, context: ProofreadingRuleContext) => void;
}>;

/**
 * コンポーズ済みの原稿を必要とするルール。配置に依存する指摘のためのものである。
 */
export type ComposedProofreadingRule<TComposed extends ComposedManuscript = ComposedManuscript> =
  Readonly<{
    kind: "composed";
    meta: ProofreadingRuleMeta;
    check: (manuscript: TComposed, context: ProofreadingRuleContext) => void;
  }>;

export type ProofreadingRule = ParsedProofreadingRule | ComposedProofreadingRule;
