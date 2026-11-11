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
 * `TRule` にはあえて制約を付けない。あるコンポーザーの原稿向けに書かれたルールは
 * `ProofreadingRule` ではない。より狭い原稿を受け取るということは、より狭い関数になるからである。
 * 各呼び出しが実際にどのルールを受け付けるかは、下のオーバーロードで定める。
 */
export type ProofreadOptions<TRule> = Readonly<{
  rules: readonly TRule[];
}>;

type Diagnostics = readonly ManuscriptDiagnostic[];
type ProofreadOutcome = ManuscriptResult<Diagnostics, ProofreadError>;

/**
 * メタデータを検証済みのルール。ランナーが指摘の帰属先とする、ブランド付きの ID を持つ。
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
 * ルールを単体で実行し、報告された内容を返す。
 * コンポーズ済み専用のルールをパース済みの原稿に対して実行した場合は、単にスキップする。
 * 呼び出し側が、このルールには見えないステージを要求したためである。
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

  // サードパーティ製のルールは例外を投げることがある。それはステージの外へ漏らさず、
  // 型付きのエラーとして表に出さなければならない。
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
 * ルールは、チェック対象のコンポーズ済み原稿そのものに対して型付けされる。
 * したがって、グリッド専用のルールに別のコンポーザーの原稿を渡すことはできない。
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
