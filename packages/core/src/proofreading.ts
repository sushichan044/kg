import * as v from "valibot";

import { diagnostic, failure, mergeManuscriptRanges, success } from "./model";
import { ManuscriptRangeSchema } from "./model";
import type { ManuscriptDiagnostic, ManuscriptRange, ManuscriptResult, TextRange } from "./model";
import type { ParsedManuscript } from "./notation";
import type { ComposedManuscript } from "./pagination";

const readonlyObject = <const TEntries extends v.ObjectEntries>(entries: TEntries) =>
  v.pipe(v.strictObject(entries), v.readonly());

export const ProofreadingReportSchema = readonlyObject({
  range: ManuscriptRangeSchema,
  messageId: v.string(),
  data: v.optional(v.pipe(v.record(v.string(), v.union([v.string(), v.number()])), v.readonly())),
});

export type ProofreadingReport = v.InferOutput<typeof ProofreadingReportSchema>;

export interface ProofreadingRuleContext {
  report(report: ProofreadingReport): void;
}

export const ProofreadingRuleMetaSchema = readonlyObject({
  id: v.pipe(v.string(), v.nonEmpty(), v.regex(/^[^/]+\/[^/]+$/u)),
  requires: v.picklist(["parsed", "composed"]),
  messages: v.pipe(v.record(v.string(), v.string()), v.readonly()),
});

export type ProofreadingRuleMeta = v.InferOutput<typeof ProofreadingRuleMetaSchema>;

export interface ParsedProofreadingRule {
  readonly meta: ProofreadingRuleMeta & { readonly requires: "parsed" };
  check(manuscript: ParsedManuscript, context: ProofreadingRuleContext): void;
}

export interface ComposedProofreadingRule<
  TComposed extends ComposedManuscript = ComposedManuscript,
> {
  readonly meta: ProofreadingRuleMeta & { readonly requires: "composed" };
  check(manuscript: TComposed, context: ProofreadingRuleContext): void;
}

export type ProofreadingRule = ParsedProofreadingRule | ComposedProofreadingRule;

export interface ProofreadOptions<TRule extends ProofreadingRule> {
  readonly rules: readonly TRule[];
}

const graphemeSegmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
const DEFAULT_PARAGRAPH_LEADING_CHARACTERS = "　「『〖〈《（(“\"‘'［[〔｛{＜<";

interface DisplayLine {
  readonly text: string;
  readonly start: number;
}

function splitDisplayLines(text: string): DisplayLine[] {
  const lines: DisplayLine[] = [];
  let start = 0;
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character !== "\n" && character !== "\r") {
      index += 1;
      continue;
    }
    lines.push({ text: text.slice(start, index), start });
    index += character === "\r" && text[index + 1] === "\n" ? 2 : 1;
    start = index;
  }
  lines.push({ text: text.slice(start), start });
  return lines;
}

function displayRange(manuscript: ParsedManuscript, start: number, end: number): ManuscriptRange {
  const selected = manuscript.graphemes.filter(
    ({ range }) => range.display.start < end && range.display.end > start,
  );
  const merged = mergeManuscriptRanges(selected.map(({ range }) => range));
  if (merged === null) {
    return v.parse(ManuscriptRangeSchema, {
      source: { start: 0, end: 0 },
      display: { start, end },
      graphemes: { start: 0, end: 0 },
    });
  }
  const first = selected[0]!;
  const last = selected.at(-1)!;
  const sourceStart =
    first.range.source.start +
    Math.min(start - first.range.display.start, first.range.source.end - first.range.source.start);
  const sourceEnd =
    end === last.range.display.end
      ? last.range.source.end
      : last.range.source.start +
        Math.min(end - last.range.display.start, last.range.source.end - last.range.source.start);
  return v.parse(ManuscriptRangeSchema, {
    source: { start: sourceStart, end: sourceEnd },
    display: { start, end },
    graphemes: merged.graphemes,
  });
}

function sourceRange(manuscript: ParsedManuscript, source: TextRange): ManuscriptRange {
  const selected = manuscript.graphemes.filter(
    ({ range }) => range.source.start < source.end && range.source.end > source.start,
  );
  const annotation = manuscript.annotations.find(
    ({ range }) => range.source.start <= source.start && range.source.end >= source.end,
  );
  const merged =
    mergeManuscriptRanges(selected.map(({ range }) => range)) ?? annotation?.range ?? null;
  return v.parse(ManuscriptRangeSchema, {
    source,
    display: merged?.display ?? { start: 0, end: 0 },
    graphemes: merged?.graphemes ?? { start: 0, end: 0 },
  });
}

function interpolate(template: string, data: ProofreadingReport["data"]): string {
  return template.replaceAll(/\{\{\s*([^}\s]+)\s*\}\}/gu, (_match, key: string) =>
    String(data?.[key] ?? ""),
  );
}

function defineParsedRule(
  id: `${string}/${string}`,
  message: string,
  check: (manuscript: ParsedManuscript, report: (range: ManuscriptRange) => void) => void,
): ManuscriptResult<ParsedProofreadingRule> {
  return success({
    meta: { id, requires: "parsed", messages: { default: message } },
    check: (manuscript, context) => {
      check(manuscript, (range) => {
        context.report({ range, messageId: "default" });
      });
    },
  });
}

interface MatchRuleOptions {
  readonly id: `${string}/${string}`;
  readonly pattern: RegExp;
  readonly message: string;
  readonly test?: (match: RegExpExecArray) => boolean;
}

function createMatchRule(options: MatchRuleOptions): ManuscriptResult<ParsedProofreadingRule> {
  return defineParsedRule(options.id, options.message, (manuscript, report) => {
    for (const line of splitDisplayLines(manuscript.displayText)) {
      options.pattern.lastIndex = 0;
      let match = options.pattern.exec(line.text);
      while (match !== null) {
        if (options.test?.(match) ?? true) {
          report(
            displayRange(
              manuscript,
              line.start + match.index,
              line.start + match.index + match[0].length,
            ),
          );
        }
        match = options.pattern.exec(line.text);
      }
    }
  });
}

export function createParagraphLeadingCharacterRule(
  options: { readonly allowedCharacters?: string } = {},
): ManuscriptResult<ParsedProofreadingRule> {
  const allowedCharacters = options.allowedCharacters ?? DEFAULT_PARAGRAPH_LEADING_CHARACTERS;
  if (!v.is(v.pipe(v.string(), v.nonEmpty()), allowedCharacters)) {
    return failure("proofread", "invalid-rule-options", "allowedCharacters must not be empty");
  }
  return defineParsedRule(
    "kg/paragraph-leading-character",
    "段落の先頭には全角スペースまたは開き括弧が必要です",
    (manuscript, report) => {
      for (const line of splitDisplayLines(manuscript.displayText)) {
        if (line.text !== "" && !allowedCharacters.includes(line.text[0] ?? "")) {
          const length = (line.text.codePointAt(0) ?? 0) > 0xffff ? 2 : 1;
          report(displayRange(manuscript, line.start, line.start + length));
        }
      }
    },
  );
}

export const createPunctuationBeforeClosingQuoteRule = () =>
  createMatchRule({
    id: "kg/punctuation-before-closing-quote",
    pattern: /[。、]+(?=[」』〗〉》）)”"’'］\]〕｝}＞>])/gu,
    message: "閉じ括弧の直前に句読点を置くことはできません",
  });

export const createSpaceAfterQuestionOrExclamationRule = () =>
  createMatchRule({
    id: "kg/space-after-question-or-exclamation",
    pattern: /[？！](?![ 　？！」』〗〉》）)”"’'］\]〕｝}＞>]|$)/gu,
    message: "感嘆符または疑問符の直後には空白か閉じ括弧が必要です",
  });

export const createEvenEllipsisRule = () =>
  createMatchRule({
    id: "kg/even-ellipsis",
    pattern: /…+/gu,
    test: (match) => match[0].length % 2 === 1,
    message: "連続する三点リーダーの数は偶数にしてください",
  });

export const createEvenDashRule = () =>
  createMatchRule({
    id: "kg/even-dash",
    pattern: /―+/gu,
    test: (match) => match[0].length % 2 === 1,
    message: "連続するダッシュの数は偶数にしてください",
  });

export const createNoConsecutivePunctuationRule = () =>
  createMatchRule({
    id: "kg/no-consecutive-punctuation",
    pattern: /。。+|、、+/gu,
    message: "句読点が連続しています",
  });

export const createNoConsecutiveInterpunctRule = () =>
  createMatchRule({
    id: "kg/no-consecutive-interpunct",
    pattern: /・・+/gu,
    message: "中黒が連続しています",
  });

export const createNoConsecutiveChoonpuRule = () =>
  createMatchRule({
    id: "kg/no-consecutive-choonpu",
    pattern: /ーー+/gu,
    message: "長音符が連続しています",
  });

export const createMinusBeforeNumberRule = () =>
  createMatchRule({
    id: "kg/minus-before-number",
    pattern: /−(?![0-9０-９〇一二三四五六七八九十])/gu,
    message: "マイナス記号の直後には数字が必要です",
  });

export function createMaxArabicNumeralDigitsRule(
  options: { readonly maxDigits?: number } = {},
): ManuscriptResult<ParsedProofreadingRule> {
  const maxDigits = options.maxDigits ?? 2;
  if (!v.is(v.pipe(v.number(), v.finite(), v.integer(), v.minValue(1)), maxDigits)) {
    return failure("proofread", "invalid-rule-options", "maxDigits must be a positive integer");
  }
  return createMatchRule({
    id: "kg/max-arabic-numeral-digits",
    pattern: /([0-9０-９]+)(?:[.．]([0-9０-９]+))?/gu,
    test: (match) => (match[1]?.length ?? 0) > maxDigits || (match[2]?.length ?? 0) > maxDigits,
    message: `${maxDigits}桁を超えるアラビア数字が使われています`,
  });
}

function isVariantCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) return false;
  return (
    (codePoint >= 0x180b && codePoint <= 0x180d) ||
    codePoint === 0x180f ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0x2f800 && codePoint <= 0x2fa1f) ||
    (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
  );
}

export function createVariantCharacterRule(): ManuscriptResult<ParsedProofreadingRule> {
  return defineParsedRule(
    "kg/variant-character",
    "異体字または字形選択子が使われています",
    (manuscript, report) => {
      for (const { index, segment } of graphemeSegmenter.segment(manuscript.source)) {
        if (Array.from(segment).some(isVariantCharacter)) {
          report(sourceRange(manuscript, { start: index, end: index + segment.length }));
        }
      }
    },
  );
}

export function createDefaultProofreadingRules(): ManuscriptResult<
  readonly ParsedProofreadingRule[]
> {
  const results = [
    createParagraphLeadingCharacterRule(),
    createPunctuationBeforeClosingQuoteRule(),
    createSpaceAfterQuestionOrExclamationRule(),
    createEvenEllipsisRule(),
    createEvenDashRule(),
    createNoConsecutivePunctuationRule(),
    createNoConsecutiveInterpunctRule(),
    createNoConsecutiveChoonpuRule(),
    createMinusBeforeNumberRule(),
    createMaxArabicNumeralDigitsRule(),
    createVariantCharacterRule(),
  ];
  const failed = results.find((result) => !result.ok);
  if (failed !== undefined) return failed;
  return success(results.flatMap((result) => (result.ok ? [result.value] : [])));
}

function isComposed(
  manuscript: ParsedManuscript | ComposedManuscript,
): manuscript is ComposedManuscript {
  return "composerId" in manuscript;
}

export function proofreadManuscript(
  manuscript: ParsedManuscript,
  options: ProofreadOptions<ParsedProofreadingRule>,
): ManuscriptResult<readonly ManuscriptDiagnostic[]>;
export function proofreadManuscript(
  manuscript: ComposedManuscript,
  options: ProofreadOptions<ProofreadingRule>,
): ManuscriptResult<readonly ManuscriptDiagnostic[]>;
export function proofreadManuscript(
  manuscript: ParsedManuscript | ComposedManuscript,
  options: ProofreadOptions<ProofreadingRule>,
): ManuscriptResult<readonly ManuscriptDiagnostic[]> {
  const metadata = v.safeParse(
    v.pipe(
      v.array(ProofreadingRuleMetaSchema),
      v.check(
        (items) => new Set(items.map(({ id }) => id)).size === items.length,
        "rule IDs must be unique",
      ),
    ),
    options.rules.map(({ meta }) => meta),
  );
  if (!metadata.success) {
    const invalidId = metadata.issues.some(({ type }) => type === "regex");
    if (invalidId) {
      return failure("proofread", "invalid-rule-id", "rule IDs must use namespace/name");
    }
    const duplicateId = metadata.issues.some(({ type }) => type === "check");
    return duplicateId
      ? failure("proofread", "duplicate-rule", "rule IDs must be unique")
      : failure("proofread", "invalid-rule", "rule metadata is invalid");
  }
  const parsed = isComposed(manuscript) ? manuscript.parsed : manuscript;
  const diagnostics: ManuscriptDiagnostic[] = [];
  try {
    for (const rule of options.rules) {
      const reports: unknown[] = [];
      const context: ProofreadingRuleContext = { report: (report) => reports.push(report) };
      if (rule.meta.requires === "parsed") {
        (rule as ParsedProofreadingRule).check(parsed, context);
      } else if (isComposed(manuscript)) {
        (rule as ComposedProofreadingRule).check(manuscript, context);
      }
      const validatedReports = v.safeParse(v.array(ProofreadingReportSchema), reports);
      if (!validatedReports.success) {
        return failure("proofread", "invalid-report", "rule reported an invalid diagnostic");
      }
      for (const report of validatedReports.output) {
        const template = rule.meta.messages[report.messageId];
        if (template === undefined) {
          return failure("proofread", "unknown-message", "rule reported an unknown message ID");
        }
        diagnostics.push(
          diagnostic(
            parsed.source,
            { kind: "rule", id: rule.meta.id },
            "error",
            report.messageId,
            interpolate(template, report.data),
            report.range,
          ),
        );
      }
    }
  } catch (error) {
    return failure(
      "proofread",
      "rule-failed",
      error instanceof Error ? error.message : "proofreading rule failed",
    );
  }
  diagnostics.sort(
    (left, right) =>
      left.range.source.start - right.range.source.start ||
      left.range.source.end - right.range.source.end ||
      left.origin.id.localeCompare(right.origin.id),
  );
  return success(diagnostics);
}
