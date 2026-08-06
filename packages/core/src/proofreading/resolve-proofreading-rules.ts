import * as v from "valibot";

import { DiagnosticSeverity } from "../diagnostic/diagnostic-severity";
import { readonlyObject } from "../internal/schema";
import { ManuscriptResult } from "../result/manuscript-result";
import { ValidationIssue } from "../result/validation-issue";
import type { ProofreadingConfigError } from "./proofreading-config-error";
import type { ParsedProofreadingRule } from "./proofreading-rule";
import type { ProofreadingRuleContext } from "./proofreading-rule-context";
import type { ProofreadingRuleSettings } from "./proofreading-rule-settings";
import { proofreadingRuleRegistry } from "./rules/registry";

const LevelSchema = v.union([v.picklist(["off", "on"]), DiagnosticSeverity.schema]);

/**
 * Validated loosely on purpose: whether a rule takes an options tuple, and what shape those options
 * are, is a per-rule concern that {@link resolveProofreadingRules} checks against the matching
 * definition. This schema only rejects a config that is not shaped like settings at all.
 */
const ProofreadingRuleSettingSchema = v.union([
  LevelSchema,
  v.pipe(v.tuple([LevelSchema, v.unknown()]), v.readonly()),
]);

const ProofreadingConfigSchema = readonlyObject({
  rules: v.pipe(v.record(v.string(), ProofreadingRuleSettingSchema), v.readonly()),
});

export type ProofreadingConfig = Readonly<{ rules: ProofreadingRuleSettings }>;

const registryById: ReadonlyMap<string, (typeof proofreadingRuleRegistry)[number]> = new Map(
  proofreadingRuleRegistry.map((definition) => [definition.id, definition]),
);

/**
 * Wraps a rule so every report it produces carries `severity`, overriding whatever severity the
 * rule itself chose. The rule's `check` is otherwise untouched: this only intercepts the context it
 * reports through.
 */
function withSeverity(
  rule: ParsedProofreadingRule,
  severity: DiagnosticSeverity,
): ParsedProofreadingRule {
  return {
    ...rule,
    check: (manuscript, context) => {
      const overridden: ProofreadingRuleContext = {
        report: (report) => {
          context.report({ ...report, severity });
        },
      };
      rule.check(manuscript, overridden);
    },
  };
}

/**
 * Resolves a rule ID → setting config into rule instances the way `proofreadManuscript` expects
 * them, applying options and severity per rule the way ESLint and textlint apply per-rule config.
 *
 * `"off"` and an absent entry both skip the rule. `"on"` keeps the rule's own report severity;
 * `"warning"` and `"error"` override every report the rule produces, config winning over the rule's
 * own default the way it does in ESLint and textlint.
 */
export function resolveProofreadingRules(
  config: ProofreadingConfig,
): ManuscriptResult<readonly ParsedProofreadingRule[], ProofreadingConfigError> {
  const parsedConfig = v.safeParse(ProofreadingConfigSchema, config);
  if (!parsedConfig.success) {
    return ManuscriptResult.fail({
      kind: "InvalidConfig",
      issues: ValidationIssue.from(parsedConfig.issues),
    });
  }

  const settings: Readonly<Record<string, v.InferOutput<typeof ProofreadingRuleSettingSchema>>> =
    parsedConfig.output.rules;

  for (const ruleId of Object.keys(settings)) {
    if (!registryById.has(ruleId)) {
      return ManuscriptResult.fail({ kind: "UnknownRuleId", ruleId });
    }
  }

  const rules: ParsedProofreadingRule[] = [];

  for (const definition of proofreadingRuleRegistry) {
    const setting = settings[definition.id];
    if (setting === undefined) continue;

    const [level, rawOptions] = typeof setting === "string" ? [setting, undefined] : setting;
    if (level === "off") continue;

    let rule: ParsedProofreadingRule;
    if ("optionsSchema" in definition) {
      const options = v.safeParse(definition.optionsSchema, rawOptions);
      if (!options.success) {
        return ManuscriptResult.fail({
          kind: "InvalidRuleOptions",
          ruleId: definition.id,
          issues: ValidationIssue.from(options.issues),
        });
      }
      // `definition` has widened to the union of every options-taking definition, so its
      // `create` no longer visibly matches `options.output`'s specific member — even though, for
      // whichever single definition this iteration holds, the two always agree by construction:
      // `defineProofreadingRule`'s overloads are what tied `optionsSchema`'s output to `create`'s
      // parameter at the definition site.
      const create = definition.create as (options: unknown) => ParsedProofreadingRule;
      rule = create(options.output);
    } else {
      if (rawOptions !== undefined) {
        return ManuscriptResult.fail({ kind: "UnexpectedRuleOptions", ruleId: definition.id });
      }
      rule = definition.create();
    }

    rules.push(level === "on" ? rule : withSeverity(rule, level));
  }

  return ManuscriptResult.succeed(rules);
}
