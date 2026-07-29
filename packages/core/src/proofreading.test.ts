import { describe, expect, test } from "vite-plus/test";

import { proofreadManuscript } from "./proofreading";
import type { NovelStyleRuleId } from "./proofreading";

function ruleIds(text: string): NovelStyleRuleId[] {
  return proofreadManuscript(text).map((diagnostic) => diagnostic.ruleId);
}

describe("proofreadManuscript", () => {
  test.each([
    ["字下げがない", "paragraph-leading-character"],
    ["「句点。」", "punctuation-before-closing-quote"],
    ["「驚き！次」", "space-after-question-or-exclamation"],
    ["「………」", "even-ellipsis"],
    ["「―――」", "even-dash"],
    ["「。。。 」", "no-consecutive-punctuation"],
    ["「・・・」", "no-consecutive-interpunct"],
    ["「ーーー」", "no-consecutive-choonpu"],
    ["「記号−文字」", "minus-before-number"],
    ["「西暦2026年」", "max-arabic-numeral-digits"],
  ] as const)("reports %s", (text, expected) => {
    expect(ruleIds(text)).toContain(expected);
  });

  test("accepts documented novel-style forms", () => {
    expect(
      proofreadManuscript(
        "　字下げした段落。\n「会話文」\n「驚き！　続き」\n「……――」\n「数字は２０まで、−３も可」",
      ),
    ).toEqual([]);
  });

  test("can disable individual rules and change the numeral threshold", () => {
    expect(
      proofreadManuscript("2016", {
        paragraphLeadingCharacters: false,
        maxArabicNumeralDigits: 4,
      }),
    ).toEqual([]);
  });

  test("reports stable raw ranges and locations across CRLF", () => {
    const diagnostics = proofreadManuscript("　正常\r\n問題");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      id: "paragraph-leading-character:5:6",
      range: { start: 5, end: 6 },
      location: {
        start: { offset: 5, line: 2, column: 1 },
      },
    });
  });

  test("never changes the source or exposes a replacement", () => {
    const source = "「誤り。。。 」";
    const diagnostics = proofreadManuscript(source);
    expect(source).toBe("「誤り。。。 」");
    expect(diagnostics.some((item) => "fix" in item || "replacement" in item)).toBe(false);
  });
});
