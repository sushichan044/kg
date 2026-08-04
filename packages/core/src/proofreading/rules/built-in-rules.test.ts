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
import { dashCharacterRule } from "./dash-character";
import { ellipsisCharacterRule } from "./ellipsis-character";
import { fullwidthJapanesePunctuationRule } from "./fullwidth-japanese-punctuation";
import { noIndentBeforeOpeningBracketRule } from "./no-indent-before-opening-bracket";
import { paragraphIndentWidthRule } from "./paragraph-indent-width";
import { paragraphLeadingCharacterRule } from "./paragraph-leading-character";
import { spaceAfterQuestionOrExclamationRule } from "./space-after-question-or-exclamation";

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

describe("paragraphLeadingCharacterRule", () => {
  test("leaves a line made only of decoration symbols alone", () => {
    const diagnostics = diagnose("　本文\n＊　＊　＊\n　本文", paragraphLeadingCharacterRule());

    expect(diagnostics).toEqual([]);
  });

  test("still reports prose that is not indented", () => {
    const diagnostics = diagnose("本文", paragraphLeadingCharacterRule());

    expect(only(diagnostics).range.display).toEqual({ start: 0, end: 1 });
  });
});

describe("paragraphIndentWidthRule", () => {
  test("reports an indent wider than one ideographic space", () => {
    const diagnostics = diagnose("　　本文", paragraphIndentWidthRule());

    expect(only(diagnostics).range.display).toEqual({ start: 0, end: 2 });
  });

  test("reports an ideographic space followed by a halfwidth space", () => {
    const diagnostics = diagnose("　 本文", paragraphIndentWidthRule());

    expect(only(diagnostics).range.display).toEqual({ start: 0, end: 2 });
  });

  test("accepts exactly one ideographic space", () => {
    const diagnostics = diagnose("　本文", paragraphIndentWidthRule());

    expect(diagnostics).toEqual([]);
  });

  test("leaves an indented bracket paragraph to the bracket rule", () => {
    const diagnostics = diagnose("　　「本文」", paragraphIndentWidthRule());

    expect(diagnostics).toEqual([]);
  });

  test("leaves a line of spaces alone", () => {
    const diagnostics = diagnose("　本文\n　　\n　本文", paragraphIndentWidthRule());

    expect(diagnostics).toEqual([]);
  });
});

describe("noIndentBeforeOpeningBracketRule", () => {
  test("reports the spaces before an opening bracket", () => {
    const diagnostics = diagnose("　「本文」", noIndentBeforeOpeningBracketRule());

    expect(only(diagnostics).range.display).toEqual({ start: 0, end: 1 });
  });

  test("accepts a bracket paragraph that is not indented", () => {
    const diagnostics = diagnose("「本文」", noIndentBeforeOpeningBracketRule());

    expect(diagnostics).toEqual([]);
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

describe("dashCharacterRule", () => {
  test("reports em dashes standing in for a dash", () => {
    const diagnostics = diagnose("　そう——ですか", dashCharacterRule());

    expect(only(diagnostics).range.display).toEqual({ start: 3, end: 5 });
  });

  test("reports repeated hyphens", () => {
    const diagnostics = diagnose("　そう--ですか", dashCharacterRule());

    expect(only(diagnostics).range.display).toEqual({ start: 3, end: 5 });
  });

  test("leaves a repeated choonpu to its own rule", () => {
    const diagnostics = diagnose("　そーーですか", dashCharacterRule());

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

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map(({ severity }) => severity)).toEqual(["warning", "warning"]);
    expect(diagnostics[0]?.message).toBe(
      "日本語の前後に半角の「(」があります。全角にすべきか確認してください",
    );
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

  test("honours configured pairs", () => {
    const rule = createConsistentKanjiOpeningRule({
      pairs: [{ closed: "事", opened: "こと" }],
    });
    expect.assert(rule.ok, "fixture did not build");

    const diagnostics = diagnose("　その事とそのこと", rule.value);

    expect(only(diagnostics).range.display).toEqual({ start: 3, end: 4 });
  });
});
