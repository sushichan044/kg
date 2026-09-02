import * as v from "valibot";

import type { ComposedManuscript } from "../composer/composed-manuscript";
import { ManuscriptDiagnostic } from "../diagnostic/manuscript-diagnostic";
import { assertNever } from "../internal/assert-never";
import { readonlyArray } from "../internal/schema";
import { NamespacedId } from "../namespaced-id";
import type { ParsedManuscript } from "../parser/parsed-manuscript";
import { ManuscriptResult } from "../result/manuscript-result";
import { ValidationIssue } from "../result/validation-issue";
import { interpolate } from "./internal/interpolate";
import type { ProofreadError } from "./proofread-error";
import { ProofreadingReport } from "./proofreading-report";
import { ProofreadingRuleMeta } from "./proofreading-rule";
import type {
  ComposedProofreadingRule,
  ParsedProofreadingRule,
  ProofreadingRule,
  ProofreadingRuleMessages,
} from "./proofreading-rule";
import type { ProofreadingRuleContext } from "./proofreading-rule-context";

/**
 * `TRule` is deliberately unconstrained: a rule written for one composer's manuscript is not a
 * `ProofreadingRule`, because accepting a narrower manuscript makes it a narrower function. The
 * overloads below pin down which rules each call actually accepts.
 */
export type ProofreadOptions<TRule> = Readonly<{
  rules: readonly TRule[];
}>;

type Diagnostics = readonly ManuscriptDiagnostic[];
type ProofreadOutcome = ManuscriptResult<Diagnostics, ProofreadError>;

/**
 * A rule whose metadata has been validated, carrying the branded ID the runner will attribute to.
 */
type PreparedRule = Readonly<{
  id: NamespacedId;
  messages: ProofreadingRuleMessages;
  rule: ProofreadingRule;
}>;

const reportsSchema = readonlyArray(ProofreadingReport.schema);

function prepareRules(
  rules: readonly ProofreadingRule[],
): ManuscriptResult<readonly PreparedRule[], ProofreadError> {
  const prepared: PreparedRule[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    const id = NamespacedId.parse(rule.meta.id);
    if (id === undefined) {
      return ManuscriptResult.fail({ kind: "InvalidRuleId", ruleId: rule.meta.id });
    }
    if (seen.has(id)) {
      return ManuscriptResult.fail({ kind: "DuplicateRuleId", ruleId: id });
    }

    const messages = v.safeParse(ProofreadingRuleMeta.messagesSchema, rule.meta.messages);
    if (!messages.success) {
      return ManuscriptResult.fail({
        kind: "InvalidRuleMetadata",
        ruleId: id,
        issues: ValidationIssue.from(messages.issues),
      });
    }

    seen.add(id);
    prepared.push({ id, messages: messages.output, rule });
  }

  return ManuscriptResult.succeed(prepared);
}

/**
 * Runs one rule and returns what it reported. A composed-only rule against a parsed manuscript is
 * simply skipped: the caller asked for a stage this rule cannot see.
 */
function collectReports(
  { id, rule }: PreparedRule,
  parsed: ParsedManuscript,
  composed: ComposedManuscript | null,
): ManuscriptResult<readonly ProofreadingReport[], ProofreadError> {
  const reports: unknown[] = [];
  const context: ProofreadingRuleContext = {
    report: (report) => {
      reports.push(report);
    },
  };

  // A third-party rule may throw; that must surface as a typed error, not escape the stage.
  try {
    switch (rule.kind) {
      case "parsed": {
        rule.check(parsed, context);
        break;
      }
      case "composed": {
        if (composed !== null) rule.check(composed, context);
        break;
      }
      default: {
        assertNever(rule);
      }
    }
  } catch (cause) {
    return ManuscriptResult.fail({ kind: "RuleThrew", ruleId: id, cause });
  }

  const validated = v.safeParse(reportsSchema, reports);
  return validated.success
    ? ManuscriptResult.succeed(validated.output)
    : ManuscriptResult.fail({
        kind: "InvalidReport",
        ruleId: id,
        issues: ValidationIssue.from(validated.issues),
      });
}

function toDiagnostics(
  { id, messages }: PreparedRule,
  reports: readonly ProofreadingReport[],
  source: string,
): ManuscriptResult<Diagnostics, ProofreadError> {
  const diagnostics: ManuscriptDiagnostic[] = [];

  for (const report of reports) {
    const template = messages[report.messageId];
    if (template === undefined) {
      return ManuscriptResult.fail({
        kind: "UnknownMessageId",
        ruleId: id,
        messageId: report.messageId,
      });
    }

    diagnostics.push(
      ManuscriptDiagnostic.of({
        source,
        origin: { kind: "rule", id },
        severity: report.severity ?? "error",
        code: report.messageId,
        message: interpolate(template, report.data),
        range: report.range,
      }),
    );
  }

  return ManuscriptResult.succeed(diagnostics);
}

function run(
  parsed: ParsedManuscript,
  composed: ComposedManuscript | null,
  rules: readonly ProofreadingRule[],
): ProofreadOutcome {
  const prepared = prepareRules(rules);
  if (!prepared.ok) return prepared;

  const diagnostics: ManuscriptDiagnostic[] = [];
  for (const rule of prepared.value) {
    const reports = collectReports(rule, parsed, composed);
    if (!reports.ok) return reports;

    const produced = toDiagnostics(rule, reports.value, parsed.source);
    if (!produced.ok) return produced;
    diagnostics.push(...produced.value);
  }

  return ManuscriptResult.succeed([...diagnostics].sort(ManuscriptDiagnostic.compare));
}

export function proofreadManuscript(
  manuscript: ParsedManuscript,
  options: ProofreadOptions<ParsedProofreadingRule>,
): ProofreadOutcome;
/**
 * Rules are typed against the exact composed manuscript being checked, so a grid-specific rule
 * cannot be handed a manuscript from a different composer.
 */
export function proofreadManuscript<TComposed extends ComposedManuscript>(
  manuscript: TComposed,
  options: ProofreadOptions<ParsedProofreadingRule | ComposedProofreadingRule<TComposed>>,
): ProofreadOutcome;
export function proofreadManuscript(
  manuscript: ParsedManuscript | ComposedManuscript,
  options: ProofreadOptions<ProofreadingRule>,
): ProofreadOutcome {
  return "composerId" in manuscript
    ? run(manuscript.parsed, manuscript, options.rules)
    : run(manuscript, null, options.rules);
}
