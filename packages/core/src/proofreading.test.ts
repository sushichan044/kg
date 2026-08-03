import { describe, expect, test } from "vite-plus/test";

import { pixivNotation, plainTextNotation } from "./notation";
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

  test.each([
    ["CJK compatibility ideograph", "　﨑", { start: 1, end: 2 }],
    ["supplementary CJK compatibility ideograph", "　\u{2F800}", { start: 1, end: 3 }],
    ["text variation sequence", "　⭐︎", { start: 1, end: 3 }],
    ["emoji variation sequence", "　⭐️", { start: 1, end: 3 }],
    ["keycap variation sequence", "　1️⃣", { start: 1, end: 4 }],
    ["ideographic variation sequence", "　葛\u{E0100}", { start: 1, end: 4 }],
    ["supplementary variation selector", "　A\u{E01EF}", { start: 1, end: 4 }],
    ["Mongolian free variation selector", "　\u1820\u180B", { start: 1, end: 3 }],
    ["Mongolian free variation selector four", "　\u1820\u180F", { start: 1, end: 3 }],
    ["isolated variation selector", "\uFE0F", { start: 0, end: 1 }],
  ])("reports the entire grapheme for %s", (_description, source, range) => {
    const diagnostics = proofreadManuscript(source).filter(
      ({ ruleId }) => ruleId === "variant-character",
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      ruleId: "variant-character",
      range,
      location: {
        start: { line: 1, column: range.start + 1 },
        end: { line: 1, column: range.end + 1 },
      },
    });
  });

  test.each(["　⭐", "　😀", "　👩‍💻", "　👍🏽", "　高辺", "　\uE000"])(
    "does not report an unselected emoji, dictionary variant, or private-use character: %s",
    (source) => {
      expect(ruleIds(source)).not.toContain("variant-character");
    },
  );

  test("can disable variant-character diagnostics", () => {
    expect(proofreadManuscript("　⭐️﨑", { noVariantCharacters: false })).toEqual([]);
  });

  test("proofreads displayed pixiv text and maps diagnostics to raw source positions", () => {
    const source = "[b:問題]";
    const diagnostics = proofreadManuscript(source, {}, pixivNotation);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      ruleId: "paragraph-leading-character",
      range: { start: 3, end: 4 },
      location: {
        start: { offset: 3, line: 1, column: 4 },
        end: { offset: 4, line: 1, column: 5 },
      },
    });
  });

  test("does not proofread pixiv delimiters or ruby readings as displayed prose", () => {
    const source = "[[rb:「正常」>。。。2026]]";

    expect(proofreadManuscript(source, { noVariantCharacters: false }, pixivNotation)).toEqual([]);
  });

  test("still checks variant characters in hidden notation values", () => {
    const source = "[[rb:　正常>⭐️]][[emphasismark:本文>﨑]]";
    const diagnostics = proofreadManuscript(source, {}, pixivNotation).filter(
      ({ ruleId }) => ruleId === "variant-character",
    );

    expect(diagnostics.map(({ range }) => range)).toEqual([
      { start: source.indexOf("⭐️"), end: source.indexOf("⭐️") + "⭐️".length },
      { start: source.indexOf("﨑"), end: source.indexOf("﨑") + 1 },
    ]);
  });

  test("keeps plain text diagnostics identical when the default notation is explicit", () => {
    const source = "　正常\r\n問題⭐️";

    expect(proofreadManuscript(source, {}, plainTextNotation)).toEqual(proofreadManuscript(source));
  });
});
