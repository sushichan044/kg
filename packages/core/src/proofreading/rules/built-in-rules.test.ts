import { describe, expect, test } from "vite-plus/test";

import type { ManuscriptDiagnostic } from "../../diagnostic/manuscript-diagnostic";
import { parseManuscript } from "../../parser/parse-manuscript";
import { proofreadManuscript } from "../proofread-manuscript";
import type { ParsedProofreadingRule } from "../proofreading-rule";
import {
  consistentKanjiOpeningRule,
  createConsistentKanjiOpeningRule,
} from "./consistent-kanji-opening";
import { consistentLatinWidthRule } from "./consistent-latin-width";
import { consistentNumeralWidthRule } from "./consistent-numeral-width";
import { createDashRule, dashRule } from "./dash";
import { createDefaultProofreadingRules } from "./default-rules";
import { ellipsisCharacterRule } from "./ellipsis-character";
import { fullwidthJapanesePunctuationRule } from "./fullwidth-japanese-punctuation";
import { createParagraphOpeningRule, paragraphOpeningRule } from "./paragraph-opening";
import { spaceAfterQuestionOrExclamationRule } from "./space-after-question-or-exclamation";
import { variantCharacterRule } from "./variant-character";

function diagnose(source: string, rule: ParsedProofreadingRule): readonly ManuscriptDiagnostic[] {
  const parsed = parseManuscript(source);
  expect.assert(parsed.ok, "fixture did not parse");

  const result = proofreadManuscript(parsed.value, { rules: [rule] });
  expect.assert(result.ok, "expected proofreadManuscript to succeed");

  return result.value;
}

function only(diagnostics: readonly ManuscriptDiagnostic[]): ManuscriptDiagnostic {
  expect(diagnostics).toHaveLength(1);
  const first = diagnostics[0];
  expect.assert(first !== undefined, "expected one diagnostic");

  return first;
}

function diagnoseWithDefaults(source: string): readonly ManuscriptDiagnostic[] {
  const parsed = parseManuscript(source);
  expect.assert(parsed.ok, "fixture did not parse");

  const result = proofreadManuscript(parsed.value, { rules: createDefaultProofreadingRules() });
  expect.assert(result.ok, "expected proofreadManuscript to succeed");

  return result.value;
}

describe("paragraphOpeningRule", () => {
  test("reports prose that is not indented", () => {
    const diagnostics = diagnose("本文", paragraphOpeningRule());

    expect(only(diagnostics)).toMatchObject({
      message: "段落の先頭には全角スペースまたは開き括弧が必要です",
      range: { display: { start: 0, end: 1 } },
    });
  });

  test("reports a halfwidth space where the indent belongs", () => {
    const diagnostics = diagnose(" 本文", paragraphOpeningRule());

    expect(only(diagnostics)).toMatchObject({
      message: "段落の先頭には全角スペースまたは開き括弧が必要です",
      range: { display: { start: 0, end: 1 } },
    });
  });

  test("reports a tab where the indent belongs", () => {
    const diagnostics = diagnose("\t本文", paragraphOpeningRule());

    expect(only(diagnostics)).toMatchObject({
      message: "段落の先頭には全角スペースまたは開き括弧が必要です",
      range: { display: { start: 0, end: 1 } },
    });
  });

  test("accepts exactly one ideographic space", () => {
    const diagnostics = diagnose("　本文", paragraphOpeningRule());

    expect(diagnostics).toEqual([]);
  });

  test("reports an indent wider than one ideographic space", () => {
    const diagnostics = diagnose("　　本文", paragraphOpeningRule());

    expect(only(diagnostics)).toMatchObject({
      message: "段落冒頭の字下げは全角スペース1字にしてください",
      range: { display: { start: 0, end: 2 } },
    });
  });

  test("reports an ideographic space followed by a halfwidth space", () => {
    const diagnostics = diagnose("　 本文", paragraphOpeningRule());

    expect(only(diagnostics)).toMatchObject({
      message: "段落冒頭の字下げは全角スペース1字にしてください",
      range: { display: { start: 0, end: 2 } },
    });
  });

  test("accepts a paragraph that opens with a bracket", () => {
    const diagnostics = diagnose("「本文」", paragraphOpeningRule());

    expect(diagnostics).toEqual([]);
  });

  test("reports the indent before a paragraph that opens with a bracket", () => {
    const diagnostics = diagnose("　「本文」", paragraphOpeningRule());

    expect(only(diagnostics)).toMatchObject({
      message: "括弧から始まる段落を字下げすることはできません",
      range: { display: { start: 0, end: 1 } },
    });
  });

  test("reports a halfwidth indent before a bracket once, not as two findings", () => {
    const diagnostics = diagnose(" 「本文」", paragraphOpeningRule());

    expect(only(diagnostics)).toMatchObject({
      message: "括弧から始まる段落を字下げすることはできません",
      range: { display: { start: 0, end: 1 } },
    });
  });

  test("leaves a line made only of decoration symbols alone", () => {
    const diagnostics = diagnose("　本文\n＊　＊　＊\n　本文", paragraphOpeningRule());

    expect(diagnostics).toEqual([]);
  });

  test("leaves a line of spaces alone", () => {
    const diagnostics = diagnose("　本文\n　　\n　本文", paragraphOpeningRule());

    expect(diagnostics).toEqual([]);
  });
});

describe("createParagraphOpeningRule", () => {
  test("reports the offending option when given an empty bracket set", () => {
    const result = createParagraphOpeningRule({ openingBrackets: "" });

    expect.assert(result.ok === false, "expected createParagraphOpeningRule to reject");
    expect(result.error).toMatchObject({
      kind: "InvalidRuleOptions",
      ruleId: "kg/paragraph-opening",
      option: "openingBrackets",
    });
  });

  test("treats a character outside the configured brackets as prose", () => {
    const rule = createParagraphOpeningRule({ openingBrackets: "《" });
    expect.assert(rule.ok, "fixture did not build");

    const diagnostics = diagnose("　《本文》\n　「本文」", rule.value);

    expect(only(diagnostics)).toMatchObject({
      message: "括弧から始まる段落を字下げすることはできません",
      range: { display: { start: 0, end: 1 } },
    });
  });
});

describe("spaceAfterQuestionOrExclamationRule", () => {
  test("reports the whole run of marks when no gap follows", () => {
    const diagnostics = diagnose("　えっ！？そんな", spaceAfterQuestionOrExclamationRule());

    expect(only(diagnostics)).toMatchObject({
      message: "感嘆符または疑問符の直後には全角スペースか閉じ括弧が必要です",
      range: { display: { start: 3, end: 5 } },
    });
  });

  test("accepts exactly one ideographic space", () => {
    const diagnostics = diagnose("　えっ！　そんな", spaceAfterQuestionOrExclamationRule());

    expect(diagnostics).toEqual([]);
  });

  test("reports two ideographic spaces", () => {
    const diagnostics = diagnose("　えっ！　　そんな", spaceAfterQuestionOrExclamationRule());

    expect(only(diagnostics)).toMatchObject({
      message: "感嘆符または疑問符の直後の空白は全角スペース1字にしてください",
      range: { display: { start: 4, end: 6 } },
    });
  });

  test("reports a halfwidth space", () => {
    const diagnostics = diagnose("　えっ！ そんな", spaceAfterQuestionOrExclamationRule());

    expect(only(diagnostics).message).toBe(
      "感嘆符または疑問符の直後の空白は全角スペース1字にしてください",
    );
  });

  test("accepts a closing bracket right after the marks", () => {
    const diagnostics = diagnose("「えっ！」", spaceAfterQuestionOrExclamationRule());

    expect(diagnostics).toEqual([]);
  });

  test("reports a space between the marks and a closing bracket", () => {
    const diagnostics = diagnose("「えっ！　」", spaceAfterQuestionOrExclamationRule());

    expect(only(diagnostics)).toMatchObject({
      message: "閉じ括弧の直前に空白を置くことはできません",
      range: { display: { start: 4, end: 5 } },
    });
  });

  test("accepts marks at the end of a line", () => {
    const diagnostics = diagnose("　えっ！\n　本文", spaceAfterQuestionOrExclamationRule());

    expect(diagnostics).toEqual([]);
  });
});

describe("ellipsisCharacterRule", () => {
  test("reports halfwidth periods standing in for an ellipsis", () => {
    const diagnostics = diagnose("　そう...ですか", ellipsisCharacterRule());

    expect(only(diagnostics).range.display).toEqual({ start: 3, end: 6 });
  });

  test("reports a midline horizontal ellipsis", () => {
    const diagnostics = diagnose("　そう⋯ですか", ellipsisCharacterRule());

    expect(only(diagnostics).range.display).toEqual({ start: 3, end: 4 });
  });
});

describe("dashRule", () => {
  test("accepts an even run of the default dash", () => {
    const diagnostics = diagnose("　そう――ですか", dashRule());

    expect(diagnostics).toEqual([]);
  });

  test("reports an odd run of the default dash", () => {
    const diagnostics = diagnose("　そう―ですか", dashRule());

    expect(only(diagnostics)).toMatchObject({
      id: "rule:kg/dash:even-count:3:4",
      origin: { id: "kg/dash" },
      message: "連続するダッシュの数は偶数にしてください",
      range: { display: { start: 3, end: 4 } },
    });
  });

  test("reports em dashes when the default dash is preferred", () => {
    const diagnostics = diagnose("　そう——ですか", dashRule());

    expect(only(diagnostics)).toMatchObject({
      id: "rule:kg/dash:character:3:5",
      origin: { id: "kg/dash" },
      message: "ダッシュには「―」を使ってください",
      range: { display: { start: 3, end: 5 } },
    });
  });

  test("reports repeated hyphens", () => {
    const diagnostics = diagnose("　そう--ですか", dashRule());

    expect(only(diagnostics).range.display).toEqual({ start: 3, end: 5 });
  });

  test.each(["–", "─", "━", "﹣", "－"])("reports the non-preferred dash %s", (dash) => {
    const diagnostics = diagnose(`　そう${dash}${dash}ですか`, dashRule());

    expect(only(diagnostics)).toMatchObject({
      id: "rule:kg/dash:character:3:5",
      message: "ダッシュには「―」を使ってください",
    });
  });

  test("accepts a single ASCII hyphen", () => {
    const diagnostics = diagnose("　A-B", dashRule());

    expect(diagnostics).toEqual([]);
  });

  test("reports a mixed run only as a character error", () => {
    const diagnostics = diagnose("　そう―—―ですか", dashRule());

    expect(only(diagnostics)).toMatchObject({
      id: "rule:kg/dash:character:3:6",
      range: { display: { start: 3, end: 6 } },
    });
  });

  test("leaves repeated choonpu alone", () => {
    const diagnostics = diagnose("　そーーですか", dashRule());

    expect(diagnostics).toEqual([]);
  });
});

describe("createDashRule", () => {
  test.each([
    { preferred: "—" as const, alternative: "―" },
    { preferred: "─" as const, alternative: "—" },
  ])("honours $preferred as the preferred dash", ({ preferred, alternative }) => {
    const result = createDashRule({ preferred });
    expect.assert(result.ok, "fixture did not build");

    const accepted = diagnose(`　そう${preferred}${preferred}ですか`, result.value);
    const odd = diagnose(`　そう${preferred}ですか`, result.value);
    const rejected = diagnose(`　そう${alternative}${alternative}ですか`, result.value);

    expect(accepted).toEqual([]);
    expect(only(odd)).toMatchObject({
      id: "rule:kg/dash:even-count:3:4",
      message: "連続するダッシュの数は偶数にしてください",
    });
    expect(only(rejected)).toMatchObject({
      id: "rule:kg/dash:character:3:5",
      message: `ダッシュには「${preferred}」を使ってください`,
    });
  });

  test("rejects a character that is not a supported dash", () => {
    // JavaScript callers are not protected by DashOptions, so the runtime boundary must reject it.
    const result = createDashRule({ preferred: "ー" as never });

    expect.assert(result.ok === false, "expected createDashRule to reject");
    expect(result.error).toMatchObject({
      kind: "InvalidRuleOptions",
      ruleId: "kg/dash",
      option: "preferred",
    });
  });
});

describe("createDefaultProofreadingRules", () => {
  test("allows repeated choonpu", () => {
    const diagnostics = diagnoseWithDefaults("　そーーですか");

    expect(diagnostics).toEqual([]);
  });
});

describe("fullwidthJapanesePunctuationRule", () => {
  test("reports halfwidth kana punctuation as an error", () => {
    const diagnostics = diagnose("　こんにちは｡", fullwidthJapanesePunctuationRule());

    expect(only(diagnostics)).toMatchObject({
      severity: "error",
      message: "半角の「｡」があります。日本語の句読点・括弧・感嘆符・疑問符は全角にしてください",
    });
  });

  test("warns about halfwidth parentheses beside Japanese", () => {
    const diagnostics = diagnose("　本文(注)", fullwidthJapanesePunctuationRule());

    expect(diagnostics.map(({ severity, message }) => ({ severity, message }))).toEqual([
      {
        severity: "warning",
        message: "日本語の前後に半角の「(」があります。全角にすべきか確認してください",
      },
      {
        severity: "warning",
        message: "日本語の前後に半角の「)」があります。全角にすべきか確認してください",
      },
    ]);
  });

  test("reports a halfwidth exclamation mark beside Japanese", () => {
    const diagnostics = diagnose("　すごい!", fullwidthJapanesePunctuationRule());

    expect(only(diagnostics)).toMatchObject({
      severity: "error",
      message: "半角の「!」があります。日本語の句読点・括弧・感嘆符・疑問符は全角にしてください",
    });
  });

  test("leaves halfwidth marks in Latin text alone", () => {
    const diagnostics = diagnose("　Hello! Why?", fullwidthJapanesePunctuationRule());

    expect(diagnostics).toEqual([]);
  });

  test("leaves halfwidth punctuation in Latin text alone", () => {
    const diagnostics = diagnose("　Hello, world.", fullwidthJapanesePunctuationRule());

    expect(diagnostics).toEqual([]);
  });

  test("leaves periods standing in for an ellipsis to the ellipsis rule", () => {
    const diagnostics = diagnose("　そう...ですか", fullwidthJapanesePunctuationRule());

    expect(diagnostics).toEqual([]);
  });
});

describe("consistentNumeralWidthRule", () => {
  test("warns once at the first halfwidth numeral when both widths appear", () => {
    const diagnostics = diagnose("　1と１と2", consistentNumeralWidthRule());

    expect(only(diagnostics)).toMatchObject({
      severity: "warning",
      message: "半角数字「1」と全角数字「１」が混在しています。作品内の方針を確認してください",
      range: { display: { start: 1, end: 2 } },
    });
  });

  test("stays quiet when only one width appears", () => {
    const diagnostics = diagnose("　1と2", consistentNumeralWidthRule());

    expect(diagnostics).toEqual([]);
  });
});

describe("consistentLatinWidthRule", () => {
  test("warns once when both latin widths appear", () => {
    const diagnostics = diagnose("　AとＡ", consistentLatinWidthRule());

    expect(only(diagnostics)).toMatchObject({
      severity: "warning",
      message: "半角英字「A」と全角英字「Ａ」が混在しています。作品内の方針を確認してください",
    });
  });
});

describe("consistentKanjiOpeningRule", () => {
  test("warns at the kanji form when the kana form is also used", () => {
    const diagnostics = diagnose("　出来る\n　できる", consistentKanjiOpeningRule());

    expect(only(diagnostics)).toMatchObject({
      severity: "warning",
      message:
        "「出来る」と「できる」が混在しています。文脈上の使い分けか表記ゆれかを確認してください",
      range: { display: { start: 1, end: 4 } },
    });
  });

  test("stays quiet when only the kanji form is used", () => {
    const diagnostics = diagnose("　出来る", consistentKanjiOpeningRule());

    expect(diagnostics).toEqual([]);
  });
});

describe("createConsistentKanjiOpeningRule", () => {
  test("reports the offending option when a pair is incomplete", () => {
    const result = createConsistentKanjiOpeningRule({ pairs: [{ closed: "", opened: "こと" }] });

    expect.assert(result.ok === false, "expected createConsistentKanjiOpeningRule to reject");
    expect(result.error).toMatchObject({
      kind: "InvalidRuleOptions",
      ruleId: "kg/consistent-kanji-opening",
      option: "pairs",
    });
  });

  test("rejects a pair whose two spellings are identical", () => {
    const result = createConsistentKanjiOpeningRule({ pairs: [{ closed: "事", opened: "事" }] });

    expect.assert(result.ok === false, "expected createConsistentKanjiOpeningRule to reject");
    expect(result.error).toMatchObject({
      kind: "InvalidRuleOptions",
      ruleId: "kg/consistent-kanji-opening",
      option: "pairs",
    });
  });

  test("honours configured pairs", () => {
    const rule = createConsistentKanjiOpeningRule({
      pairs: [{ closed: "事", opened: "こと" }],
    });
    expect.assert(rule.ok, "fixture did not build");

    const diagnostics = diagnose("　その事とそのこと", rule.value);

    expect(only(diagnostics).range.display).toEqual({ start: 3, end: 4 });
  });
});

describe("variantCharacterRule", () => {
  test("stays quiet on a plain character with no selector", () => {
    const diagnostics = diagnose("☆彡", variantCharacterRule());

    expect(diagnostics).toEqual([]);
  });

  test("suggests the plain form for a star with an emoji presentation selector", () => {
    const diagnostics = diagnose("☆️彡", variantCharacterRule());

    expect(only(diagnostics)).toMatchObject({
      message: "異体字または字形選択子が使われています。「☆」ではありませんか？",
      range: { source: { start: 0, end: 2 } },
    });
  });

  test("suggests the plain form for a star with a text presentation selector", () => {
    const diagnostics = diagnose("☆︎彡", variantCharacterRule());

    expect(only(diagnostics)).toMatchObject({
      message: "異体字または字形選択子が使われています。「☆」ではありませんか？",
    });
  });

  test("suggests the base kanji for an ideographic variation sequence", () => {
    const diagnostics = diagnose("辻\u{E0100}", variantCharacterRule());

    expect(only(diagnostics)).toMatchObject({
      message: "異体字または字形選択子が使われています。「辻」ではありませんか？",
    });
  });

  test("suggests the unified form for a CJK compatibility ideograph", () => {
    const diagnostics = diagnose("\u{F900}", variantCharacterRule());

    expect(only(diagnostics)).toMatchObject({
      message: "異体字または字形選択子が使われています。「\u{8C48}」ではありませんか？",
    });
  });

  test("falls back to the plain message when no suggestion differs from the input", () => {
    const diagnostics = diagnose("᠋", variantCharacterRule());

    expect(only(diagnostics)).toMatchObject({
      message: "異体字または字形選択子が使われています",
    });
  });
});
