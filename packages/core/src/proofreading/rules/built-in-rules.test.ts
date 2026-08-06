import { describe, expect, test } from "vite-plus/test";

import type { ManuscriptDiagnostic } from "../../diagnostic/manuscript-diagnostic";
import { parseManuscript } from "../../parser/parse-manuscript";
import { proofreadManuscript } from "../proofread-manuscript";
import type { ProofreadingRuleSettings } from "../proofreading-rule-settings";
import { resolveProofreadingRules } from "../resolve-proofreading-rules";
import { createRecommendedProofreadingRules } from "./presets";

function diagnose(
  source: string,
  rules: ProofreadingRuleSettings,
): readonly ManuscriptDiagnostic[] {
  const parsed = parseManuscript(source);
  expect.assert(parsed.ok, "fixture did not parse");

  const resolved = resolveProofreadingRules({ rules });
  expect.assert(resolved.ok, "expected resolveProofreadingRules to succeed");

  const result = proofreadManuscript(parsed.value, { rules: resolved.value });
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

  const result = proofreadManuscript(parsed.value, {
    rules: createRecommendedProofreadingRules(),
  });
  expect.assert(result.ok, "expected proofreadManuscript to succeed");

  return result.value;
}

describe("kg/paragraph-opening", () => {
  test("reports prose that is not indented", () => {
    const diagnostics = diagnose("本文", { "kg/paragraph-opening": "error" });

    expect(only(diagnostics)).toMatchObject({
      message: "段落の先頭には全角スペースまたは開き括弧が必要です",
      range: { display: { start: 0, end: 1 } },
    });
  });

  test("reports a halfwidth space where the indent belongs", () => {
    const diagnostics = diagnose(" 本文", { "kg/paragraph-opening": "error" });

    expect(only(diagnostics)).toMatchObject({
      message: "段落の先頭には全角スペースまたは開き括弧が必要です",
      range: { display: { start: 0, end: 1 } },
    });
  });

  test("reports a tab where the indent belongs", () => {
    const diagnostics = diagnose("\t本文", { "kg/paragraph-opening": "error" });

    expect(only(diagnostics)).toMatchObject({
      message: "段落の先頭には全角スペースまたは開き括弧が必要です",
      range: { display: { start: 0, end: 1 } },
    });
  });

  test("accepts exactly one ideographic space", () => {
    const diagnostics = diagnose("　本文", { "kg/paragraph-opening": "error" });

    expect(diagnostics).toEqual([]);
  });

  test("reports an indent wider than one ideographic space", () => {
    const diagnostics = diagnose("　　本文", { "kg/paragraph-opening": "error" });

    expect(only(diagnostics)).toMatchObject({
      message: "段落冒頭の字下げは全角スペース1字にしてください",
      range: { display: { start: 0, end: 2 } },
    });
  });

  test("reports an ideographic space followed by a halfwidth space", () => {
    const diagnostics = diagnose("　 本文", { "kg/paragraph-opening": "error" });

    expect(only(diagnostics)).toMatchObject({
      message: "段落冒頭の字下げは全角スペース1字にしてください",
      range: { display: { start: 0, end: 2 } },
    });
  });

  test("accepts a paragraph that opens with a bracket", () => {
    const diagnostics = diagnose("「本文」", { "kg/paragraph-opening": "error" });

    expect(diagnostics).toEqual([]);
  });

  test("reports the indent before a paragraph that opens with a bracket", () => {
    const diagnostics = diagnose("　「本文」", { "kg/paragraph-opening": "error" });

    expect(only(diagnostics)).toMatchObject({
      message: "括弧から始まる段落を字下げすることはできません",
      range: { display: { start: 0, end: 1 } },
    });
  });

  test("reports a halfwidth indent before a bracket once, not as two findings", () => {
    const diagnostics = diagnose(" 「本文」", { "kg/paragraph-opening": "error" });

    expect(only(diagnostics)).toMatchObject({
      message: "括弧から始まる段落を字下げすることはできません",
      range: { display: { start: 0, end: 1 } },
    });
  });

  test("leaves a line made only of decoration symbols alone", () => {
    const diagnostics = diagnose("　本文\n＊　＊　＊\n　本文", { "kg/paragraph-opening": "error" });

    expect(diagnostics).toEqual([]);
  });

  test("leaves a line of spaces alone", () => {
    const diagnostics = diagnose("　本文\n　　\n　本文", { "kg/paragraph-opening": "error" });

    expect(diagnostics).toEqual([]);
  });

  test("treats a character outside the configured openingBrackets as prose", () => {
    const diagnostics = diagnose("　《本文》\n　「本文」", {
      "kg/paragraph-opening": ["error", { openingBrackets: "《" }],
    });

    expect(only(diagnostics)).toMatchObject({
      message: "括弧から始まる段落を字下げすることはできません",
      range: { display: { start: 0, end: 1 } },
    });
  });
});

describe("kg/space-after-question-or-exclamation", () => {
  test("reports the whole run of marks when no gap follows", () => {
    const diagnostics = diagnose("　えっ！？そんな", {
      "kg/space-after-question-or-exclamation": "error",
    });

    expect(only(diagnostics)).toMatchObject({
      message: "感嘆符または疑問符の直後には全角スペースか閉じ括弧が必要です",
      range: { display: { start: 3, end: 5 } },
    });
  });

  test("accepts exactly one ideographic space", () => {
    const diagnostics = diagnose("　えっ！　そんな", {
      "kg/space-after-question-or-exclamation": "error",
    });

    expect(diagnostics).toEqual([]);
  });

  test("reports two ideographic spaces", () => {
    const diagnostics = diagnose("　えっ！　　そんな", {
      "kg/space-after-question-or-exclamation": "error",
    });

    expect(only(diagnostics)).toMatchObject({
      message: "感嘆符または疑問符の直後の空白は全角スペース1字にしてください",
      range: { display: { start: 4, end: 6 } },
    });
  });

  test("reports a halfwidth space", () => {
    const diagnostics = diagnose("　えっ！ そんな", {
      "kg/space-after-question-or-exclamation": "error",
    });

    expect(only(diagnostics).message).toBe(
      "感嘆符または疑問符の直後の空白は全角スペース1字にしてください",
    );
  });

  test("accepts a closing bracket right after the marks", () => {
    const diagnostics = diagnose("「えっ！」", {
      "kg/space-after-question-or-exclamation": "error",
    });

    expect(diagnostics).toEqual([]);
  });

  test("reports a space between the marks and a closing bracket", () => {
    const diagnostics = diagnose("「えっ！　」", {
      "kg/space-after-question-or-exclamation": "error",
    });

    expect(only(diagnostics)).toMatchObject({
      message: "閉じ括弧の直前に空白を置くことはできません",
      range: { display: { start: 4, end: 5 } },
    });
  });

  test("accepts marks at the end of a line", () => {
    const diagnostics = diagnose("　えっ！\n　本文", {
      "kg/space-after-question-or-exclamation": "error",
    });

    expect(diagnostics).toEqual([]);
  });
});

describe("kg/ellipsis-character", () => {
  test("reports halfwidth periods standing in for an ellipsis", () => {
    const diagnostics = diagnose("　そう...ですか", { "kg/ellipsis-character": "error" });

    expect(only(diagnostics).range.display).toEqual({ start: 3, end: 6 });
  });

  test("reports a midline horizontal ellipsis", () => {
    const diagnostics = diagnose("　そう⋯ですか", { "kg/ellipsis-character": "error" });

    expect(only(diagnostics).range.display).toEqual({ start: 3, end: 4 });
  });
});

describe("kg/dash", () => {
  test("accepts an even run of the default dash", () => {
    const diagnostics = diagnose("　そう――ですか", { "kg/dash": "error" });

    expect(diagnostics).toEqual([]);
  });

  test("reports an odd run of the default dash", () => {
    const diagnostics = diagnose("　そう―ですか", { "kg/dash": "error" });

    expect(only(diagnostics)).toMatchObject({
      id: "rule:kg/dash:even-count:3:4",
      origin: { id: "kg/dash" },
      message: "連続するダッシュの数は偶数にしてください",
      range: { display: { start: 3, end: 4 } },
    });
  });

  test("reports em dashes when the default dash is preferred", () => {
    const diagnostics = diagnose("　そう——ですか", { "kg/dash": "error" });

    expect(only(diagnostics)).toMatchObject({
      id: "rule:kg/dash:character:3:5",
      origin: { id: "kg/dash" },
      message: "ダッシュには「―」を使ってください",
      range: { display: { start: 3, end: 5 } },
    });
  });

  test("reports repeated hyphens", () => {
    const diagnostics = diagnose("　そう--ですか", { "kg/dash": "error" });

    expect(only(diagnostics).range.display).toEqual({ start: 3, end: 5 });
  });

  test.each(["–", "─", "━", "﹣", "－"])("reports the non-preferred dash %s", (dash) => {
    const diagnostics = diagnose(`　そう${dash}${dash}ですか`, { "kg/dash": "error" });

    expect(only(diagnostics)).toMatchObject({
      id: "rule:kg/dash:character:3:5",
      message: "ダッシュには「―」を使ってください",
    });
  });

  test("accepts a single ASCII hyphen", () => {
    const diagnostics = diagnose("　A-B", { "kg/dash": "error" });

    expect(diagnostics).toEqual([]);
  });

  test("reports a mixed run only as a character error", () => {
    const diagnostics = diagnose("　そう―—―ですか", { "kg/dash": "error" });

    expect(only(diagnostics)).toMatchObject({
      id: "rule:kg/dash:character:3:6",
      range: { display: { start: 3, end: 6 } },
    });
  });

  test("leaves repeated choonpu alone", () => {
    const diagnostics = diagnose("　そーーですか", { "kg/dash": "error" });

    expect(diagnostics).toEqual([]);
  });

  test.each([
    { preferred: "—" as const, alternative: "―" },
    { preferred: "─" as const, alternative: "—" },
  ])("honours $preferred as the configured preferred dash", ({ preferred, alternative }) => {
    const rules: ProofreadingRuleSettings = { "kg/dash": ["error", { preferred }] };

    const accepted = diagnose(`　そう${preferred}${preferred}ですか`, rules);
    const odd = diagnose(`　そう${preferred}ですか`, rules);
    const rejected = diagnose(`　そう${alternative}${alternative}ですか`, rules);

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
});

describe("kg/max-arabic-numeral-digits", () => {
  test("honours a configured digit limit", () => {
    const diagnostics = diagnose("　12345と123", {
      "kg/max-arabic-numeral-digits": ["error", { maxDigits: 4 }],
    });

    expect(only(diagnostics).range.display).toEqual({ start: 1, end: 6 });
  });
});

describe("createRecommendedProofreadingRules", () => {
  test("allows repeated choonpu", () => {
    const diagnostics = diagnoseWithDefaults("　そーーですか");

    expect(diagnostics).toEqual([]);
  });
});

describe("kg/fullwidth-japanese-punctuation", () => {
  test("reports halfwidth kana punctuation as an error", () => {
    const diagnostics = diagnose("　こんにちは｡", { "kg/fullwidth-japanese-punctuation": "error" });

    expect(only(diagnostics)).toMatchObject({
      severity: "error",
      message: "半角の「｡」があります。日本語の句読点・括弧・感嘆符・疑問符は全角にしてください",
    });
  });

  test("reports a halfwidth exclamation mark beside Japanese", () => {
    const diagnostics = diagnose("　すごい!", { "kg/fullwidth-japanese-punctuation": "error" });

    expect(only(diagnostics)).toMatchObject({
      severity: "error",
      message: "半角の「!」があります。日本語の句読点・括弧・感嘆符・疑問符は全角にしてください",
    });
  });

  test("leaves halfwidth marks in Latin text alone", () => {
    const diagnostics = diagnose("　Hello! Why?", { "kg/fullwidth-japanese-punctuation": "error" });

    expect(diagnostics).toEqual([]);
  });
});

describe("kg/halfwidth-punctuation-near-japanese", () => {
  test("warns about halfwidth parentheses beside Japanese", () => {
    const diagnostics = diagnose("　本文(注)", {
      "kg/halfwidth-punctuation-near-japanese": "warn",
    });

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

  test("leaves halfwidth punctuation in Latin text alone", () => {
    const diagnostics = diagnose("　Hello, world.", {
      "kg/halfwidth-punctuation-near-japanese": "warn",
    });

    expect(diagnostics).toEqual([]);
  });

  test("leaves periods standing in for an ellipsis to the ellipsis rule", () => {
    const diagnostics = diagnose("　そう...ですか", {
      "kg/halfwidth-punctuation-near-japanese": "warn",
    });

    expect(diagnostics).toEqual([]);
  });

  test("can be turned off independently of kg/fullwidth-japanese-punctuation", () => {
    const diagnostics = diagnose("　本文(注)｡", {
      "kg/fullwidth-japanese-punctuation": "error",
      "kg/halfwidth-punctuation-near-japanese": "off",
    });

    expect(only(diagnostics)).toMatchObject({
      severity: "error",
      message: "半角の「｡」があります。日本語の句読点・括弧・感嘆符・疑問符は全角にしてください",
    });
  });
});

describe("kg/consistent-numeral-width", () => {
  test("warns once at the first halfwidth numeral when both widths appear", () => {
    const diagnostics = diagnose("　1と１と2", { "kg/consistent-numeral-width": "warn" });

    expect(only(diagnostics)).toMatchObject({
      severity: "warning",
      message: "半角数字「1」と全角数字「１」が混在しています。作品内の方針を確認してください",
      range: { display: { start: 1, end: 2 } },
    });
  });

  test("stays quiet when only one width appears", () => {
    const diagnostics = diagnose("　1と2", { "kg/consistent-numeral-width": "warn" });

    expect(diagnostics).toEqual([]);
  });
});

describe("kg/consistent-latin-width", () => {
  test("warns once when both latin widths appear", () => {
    const diagnostics = diagnose("　AとＡ", { "kg/consistent-latin-width": "warn" });

    expect(only(diagnostics)).toMatchObject({
      severity: "warning",
      message: "半角英字「A」と全角英字「Ａ」が混在しています。作品内の方針を確認してください",
    });
  });
});

describe("kg/consistent-kanji-opening", () => {
  test("warns at the kanji form when the kana form is also used", () => {
    const diagnostics = diagnose("　出来る\n　できる", { "kg/consistent-kanji-opening": "warn" });

    expect(only(diagnostics)).toMatchObject({
      severity: "warning",
      message:
        "「出来る」と「できる」が混在しています。文脈上の使い分けか表記ゆれかを確認してください",
      range: { display: { start: 1, end: 4 } },
    });
  });

  test("stays quiet when only the kanji form is used", () => {
    const diagnostics = diagnose("　出来る", { "kg/consistent-kanji-opening": "warn" });

    expect(diagnostics).toEqual([]);
  });

  test("honours configured pairs", () => {
    const diagnostics = diagnose("　その事とそのこと", {
      "kg/consistent-kanji-opening": ["warn", { pairs: [{ closed: "事", opened: "こと" }] }],
    });

    expect(only(diagnostics).range.display).toEqual({ start: 3, end: 4 });
  });
});

describe("kg/variant-character", () => {
  test("stays quiet on a plain character with no selector", () => {
    const diagnostics = diagnose("☆彡", { "kg/variant-character": "error" });

    expect(diagnostics).toEqual([]);
  });

  test("suggests the plain form for a star with an emoji presentation selector", () => {
    const diagnostics = diagnose("☆️彡", { "kg/variant-character": "error" });

    expect(only(diagnostics)).toMatchObject({
      message: "異体字または字形選択子が使われています。「☆」ではありませんか？",
      range: { source: { start: 0, end: 2 } },
    });
  });

  test("suggests the plain form for a star with a text presentation selector", () => {
    const diagnostics = diagnose("☆︎彡", { "kg/variant-character": "error" });

    expect(only(diagnostics)).toMatchObject({
      message: "異体字または字形選択子が使われています。「☆」ではありませんか？",
    });
  });

  test("suggests the base kanji for an ideographic variation sequence", () => {
    const diagnostics = diagnose("辻\u{E0100}", { "kg/variant-character": "error" });

    expect(only(diagnostics)).toMatchObject({
      message: "異体字または字形選択子が使われています。「辻」ではありませんか？",
    });
  });

  test("suggests the unified form for a CJK compatibility ideograph", () => {
    const diagnostics = diagnose("\u{F900}", { "kg/variant-character": "error" });

    expect(only(diagnostics)).toMatchObject({
      message: "異体字または字形選択子が使われています。「\u{8C48}」ではありませんか？",
    });
  });

  test("keeps a fullwidth base character fullwidth instead of NFKC-folding it to ASCII", () => {
    const diagnostics = diagnose("\u{FF21}\u{FE0F}", { "kg/variant-character": "error" });

    expect(only(diagnostics)).toMatchObject({
      message: "異体字または字形選択子が使われています。「\u{FF21}」ではありませんか？",
    });
  });

  test("falls back to the plain message when no suggestion differs from the input", () => {
    const diagnostics = diagnose("᠋", { "kg/variant-character": "error" });

    expect(only(diagnostics)).toMatchObject({
      message: "異体字または字形選択子が使われています",
    });
  });
});
