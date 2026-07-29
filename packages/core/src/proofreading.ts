import type { SourceRange } from "./pagination";

export const NOVEL_STYLE_RULE_IDS = [
  "paragraph-leading-character",
  "punctuation-before-closing-quote",
  "space-after-question-or-exclamation",
  "even-ellipsis",
  "even-dash",
  "no-consecutive-punctuation",
  "no-consecutive-interpunct",
  "no-consecutive-choonpu",
  "minus-before-number",
  "max-arabic-numeral-digits",
] as const;

export type NovelStyleRuleId = (typeof NOVEL_STYLE_RULE_IDS)[number];

export interface SourcePosition {
  offset: number;
  line: number;
  column: number;
}

export interface ManuscriptDiagnostic {
  id: string;
  ruleId: NovelStyleRuleId;
  message: string;
  severity: "error";
  range: SourceRange;
  location: {
    start: SourcePosition;
    end: SourcePosition;
  };
}

export interface ProofreadingOptions {
  paragraphLeadingCharacters: string | false;
  noPunctuationBeforeClosingQuote: boolean;
  spaceAfterQuestionOrExclamation: boolean;
  evenEllipsis: boolean;
  evenDash: boolean;
  noConsecutivePunctuation: boolean;
  noConsecutiveInterpunct: boolean;
  noConsecutiveChoonpu: boolean;
  minusBeforeNumber: boolean;
  maxArabicNumeralDigits: number | false;
}

export const DEFAULT_PROOFREADING_OPTIONS: ProofreadingOptions = {
  paragraphLeadingCharacters: "　「『〖〈《（(“\"‘'［[〔｛{＜<",
  noPunctuationBeforeClosingQuote: true,
  spaceAfterQuestionOrExclamation: true,
  evenEllipsis: true,
  evenDash: true,
  noConsecutivePunctuation: true,
  noConsecutiveInterpunct: true,
  noConsecutiveChoonpu: true,
  minusBeforeNumber: true,
  maxArabicNumeralDigits: 2,
};

interface SourceLine {
  text: string;
  start: number;
  number: number;
}

interface MatchRule {
  id: NovelStyleRuleId;
  pattern: RegExp;
  message: string | ((match: RegExpExecArray) => string);
  test?: (match: RegExpExecArray) => boolean;
}

function splitSourceLines(text: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let start = 0;
  let number = 1;
  let index = 0;

  while (index < text.length) {
    const character = text[index];
    if (character !== "\n" && character !== "\r") {
      index += 1;

      continue;
    }
    lines.push({ text: text.slice(start, index), start, number });
    if (character === "\r" && text[index + 1] === "\n") {
      index += 2;
    } else {
      index += 1;
    }
    start = index;
    number += 1;
  }
  lines.push({ text: text.slice(start), start, number });

  return lines;
}

function diagnostic(
  line: SourceLine,
  ruleId: NovelStyleRuleId,
  message: string,
  localRange: SourceRange,
): ManuscriptDiagnostic {
  const range = {
    start: line.start + localRange.start,
    end: line.start + localRange.end,
  };

  return {
    id: `${ruleId}:${range.start}:${range.end}`,
    ruleId,
    message,
    severity: "error",
    range,
    location: {
      start: {
        offset: range.start,
        line: line.number,
        column: localRange.start + 1,
      },
      end: {
        offset: range.end,
        line: line.number,
        column: localRange.end + 1,
      },
    },
  };
}

function collectMatches(line: SourceLine, rule: MatchRule): ManuscriptDiagnostic[] {
  const diagnostics: ManuscriptDiagnostic[] = [];
  rule.pattern.lastIndex = 0;
  let match = rule.pattern.exec(line.text);
  while (match !== null) {
    if (rule.test?.(match) ?? true) {
      diagnostics.push(
        diagnostic(
          line,
          rule.id,
          typeof rule.message === "function" ? rule.message(match) : rule.message,
          { start: match.index, end: match.index + match[0].length },
        ),
      );
    }
    match = rule.pattern.exec(line.text);
  }

  return diagnostics;
}

export function proofreadManuscript(
  text: string,
  options: Partial<ProofreadingOptions> = {},
): ManuscriptDiagnostic[] {
  const settings = { ...DEFAULT_PROOFREADING_OPTIONS, ...options };
  const diagnostics: ManuscriptDiagnostic[] = [];

  for (const line of splitSourceLines(text)) {
    const maxArabicNumeralDigits =
      typeof settings.maxArabicNumeralDigits === "number" ? settings.maxArabicNumeralDigits : null;
    if (
      line.text !== "" &&
      settings.paragraphLeadingCharacters !== false &&
      !settings.paragraphLeadingCharacters.includes(line.text[0] ?? "")
    ) {
      diagnostics.push(
        diagnostic(
          line,
          "paragraph-leading-character",
          "段落の先頭には全角スペースまたは開き括弧が必要です",
          { start: 0, end: (line.text.codePointAt(0) ?? 0) > 0xffff ? 2 : 1 },
        ),
      );
    }

    const rules: Array<MatchRule | false> = [
      settings.noPunctuationBeforeClosingQuote && {
        id: "punctuation-before-closing-quote",
        pattern: /[。、]+(?=[」』〗〉》）)”"’'］\]〕｝}＞>])/gu,
        message: "閉じ括弧の直前に句読点を置くことはできません",
      },
      settings.spaceAfterQuestionOrExclamation && {
        id: "space-after-question-or-exclamation",
        pattern: /[？！](?![ 　？！」』〗〉》）)”"’'］\]〕｝}＞>]|$)/gu,
        message: "感嘆符・疑問符の直後には空白または閉じ括弧が必要です",
      },
      settings.evenEllipsis && {
        id: "even-ellipsis",
        pattern: /…+/gu,
        test: (match) => match[0].length % 2 === 1,
        message: "連続する三点リーダーの数は偶数にしてください",
      },
      settings.evenDash && {
        id: "even-dash",
        pattern: /―+/gu,
        test: (match) => match[0].length % 2 === 1,
        message: "連続するダッシュの数は偶数にしてください",
      },
      settings.noConsecutivePunctuation && {
        id: "no-consecutive-punctuation",
        pattern: /。。+|、、+/gu,
        message: "句読点が連続しています",
      },
      settings.noConsecutiveInterpunct && {
        id: "no-consecutive-interpunct",
        pattern: /・・+/gu,
        message: "中黒が連続しています",
      },
      settings.noConsecutiveChoonpu && {
        id: "no-consecutive-choonpu",
        pattern: /ーー+/gu,
        message: "長音符が連続しています",
      },
      settings.minusBeforeNumber && {
        id: "minus-before-number",
        pattern: /−(?![0-9０-９〇一二三四五六七八九十])/gu,
        message: "マイナス記号の直後には数字が必要です",
      },
      maxArabicNumeralDigits !== null && {
        id: "max-arabic-numeral-digits",
        pattern: /([0-9０-９]+)(?:[.．]([0-9０-９]+))?/gu,
        test: (match) =>
          (match[1]?.length ?? 0) > maxArabicNumeralDigits ||
          (match[2]?.length ?? 0) > maxArabicNumeralDigits,
        message: `${maxArabicNumeralDigits}桁を超えるアラビア数字が使われています`,
      },
    ];

    for (const rule of rules) {
      if (rule !== false) {
        diagnostics.push(...collectMatches(line, rule));
      }
    }
  }

  return diagnostics.sort(
    (left, right) =>
      left.range.start - right.range.start ||
      left.range.end - right.range.end ||
      left.ruleId.localeCompare(right.ruleId),
  );
}
