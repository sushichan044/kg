import type * as v from "valibot";

import type { ParsedProofreadingRule } from "./proofreading-rule";

/**
 * A rule registered as a definition rather than an instance: config decides whether the rule runs,
 * at what severity, and — for rules that take options — with which options. Every built-in rule is
 * `kind: "parsed"` today, so a definition always produces a {@link ParsedProofreadingRule}.
 *
 * The no-options variant is a distinct shape rather than an `optionsSchema` that always resolves to
 * `undefined`: it is what tells {@link resolveProofreadingRules} that a config entry for this rule
 * can never carry an options tuple.
 */
export type ProofreadingRuleDefinition<
  TId extends string = string,
  TOptionsInput = never,
  TOptionsOutput = never,
> =
  | Readonly<{ id: TId; create: () => ParsedProofreadingRule }>
  | Readonly<{
      id: TId;
      optionsSchema: v.GenericSchema<TOptionsInput, TOptionsOutput>;
      create: (options: TOptionsOutput) => ParsedProofreadingRule;
    }>;

/**
 * Identity helper that keeps a definition's `id` a literal type and its options schema tied to
 * `create`'s parameter, instead of both widening to `string` / `unknown` under plain object
 * literals.
 */
export function defineProofreadingRule<const TId extends string, TSchema extends v.GenericSchema>(
  definition: Readonly<{
    id: TId;
    optionsSchema: TSchema;
    create: (options: v.InferOutput<TSchema>) => ParsedProofreadingRule;
  }>,
): ProofreadingRuleDefinition<TId, v.InferInput<TSchema>, v.InferOutput<TSchema>>;
export function defineProofreadingRule<const TId extends string>(
  definition: Readonly<{ id: TId; create: () => ParsedProofreadingRule }>,
): ProofreadingRuleDefinition<TId>;
// The two overloads above are what actually ties a definition's `optionsSchema` output to its
// `create` parameter; no non-generic shape can describe both of them at once, so the shared body
// falls back to `unknown` plus an explicit assertion the way an overloaded identity function
// normally does. It is still a true identity — the overloads are the only checked contract.
export function defineProofreadingRule(definition: unknown): unknown {
  return definition;
}
