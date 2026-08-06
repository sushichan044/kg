import type * as v from "valibot";

import type { ProofreadingRuleRegistry } from "./rules/registry";

/**
 * `"off"` disables the rule. `"warn"` and `"error"` both enable it and set every report it produces
 * to that severity — the same flat, three-value shape ESLint and textlint use, with no separate
 * "on" that would otherwise leave a rule's own default severity as a second, hidden axis.
 */
export type ProofreadingRuleLevel = "off" | "warn" | "error";

/**
 * The options a definition's `create` accepts, or `never` for a definition that takes none. `never`
 * rather than `undefined`: it is what removes the tuple form from {@link ProofreadingRuleSetting}
 * for such a rule, instead of merely making the tuple's second element optional.
 */
type OptionsInputOf<TDefinition> =
  TDefinition extends Readonly<{ optionsSchema: v.GenericSchema<infer TInput, unknown> }>
    ? TInput
    : never;

/**
 * One rule's config entry. A rule without options can only ever be a bare level; a rule with
 * options may also pair a level with a partial options value, since every options schema carries
 * defaults for the rest.
 */
export type ProofreadingRuleSetting<TDefinition> =
  OptionsInputOf<TDefinition> extends never
    ? ProofreadingRuleLevel
    : ProofreadingRuleLevel | readonly [ProofreadingRuleLevel, OptionsInputOf<TDefinition>];

type DefinitionById<TId extends string> = Extract<
  ProofreadingRuleRegistry[number],
  Readonly<{ id: TId }>
>;

/**
 * The full config surface: every built-in rule ID, optional, typed to the exact setting shape its
 * own definition allows.
 */
export type ProofreadingRuleSettings = {
  readonly [TId in ProofreadingRuleRegistry[number]["id"]]?: ProofreadingRuleSetting<
    DefinitionById<TId>
  >;
};
