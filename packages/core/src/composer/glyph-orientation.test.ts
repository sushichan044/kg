import { describe, expect, test } from "vite-plus/test";

import { verticalOrientationOf } from "../internal/vertical-orientation";
import { UNICODE_VERSION } from "../internal/vertical-orientation-data";
import { GlyphOrientation as PublicGlyphOrientation } from "../plugin";
import { GlyphOrientation } from "./glyph-orientation";

describe("Vertical_Orientation table", () => {
  test("is generated from the pinned Unicode version", () => {
    expect(UNICODE_VERSION).toBe("17.0.0");
  });

  test.each([
    [0x0041, "R"],
    [0x0020, "R"],
    [0x3000, "U"],
    [0x3042, "U"],
    [0x3001, "Tu"],
    [0x300c, "Tr"],
    [0x30fc, "Tr"],
    [0x20bb7, "U"],
    [0x2018, "Tr"],
    [0x201d, "Tr"],
    [0xff61, "R"],
    [0xff9f, "R"],
    [0x2065, "U"],
    [0x10ffff, "R"],
  ] as const)("reads U+%s as its UCD value", (codePoint, expected) => {
    const value = verticalOrientationOf(codePoint);

    expect(value).toBe(expected);
  });
});

describe("GlyphOrientation.of with mixed presentation", () => {
  test.each([
    ["kana", ["あ", "ア", "ゃ", "っ", "ヴ", "ヶ", "ー", "ゝ"]],
    ["kanji", ["漢", "字", "〆", "々", "〇"]],
    [
      "JIS punctuation",
      ["「", "」", "『", "』", "（", "）", "、", "。", "・", "：", "；", "〔", "【"],
    ],
    ["dividing punctuation", ["！", "？", "‼", "⁉"]],
    ["the wave dash", ["〜"]],
    ["fullwidth forms", ["Ａ", "ｚ", "０", "＃", "＠"]],
    ["symbols", ["㍿", "①", "™", "♡", "♪", "☆"]],
    // UCD は Tr で、正立にして縦組用の字形に置き換える
    // WebKit は mixed で倒すので、mixed のまま描かせないことが前提になる
    ["curly quotes", ["“", "”", "‘", "’"]],
    ["ideographic space", ["　"]],
    ["non-BMP ideographs", ["𠮷", "𪚲"]],
    ["Hangul", ["한", "글"]],
    [
      "emoji",
      [
        "😀",
        "👍\u{1F3FD}",
        "👨\u{200D}👩\u{200D}👧",
        "❤\u{FE0F}",
        "1\u{FE0F}\u{20E3}",
        "#\u{FE0F}\u{20E3}",
      ],
    ],
    ["combining voiced kana", ["あ\u{3099}", "か\u{309A}", "ㇷ\u{309A}"]],
  ] as const)("keeps %s upright", (_, graphemes) => {
    const orientations = graphemes.map((grapheme) => GlyphOrientation.of(grapheme, "mixed"));

    expect(orientations).toEqual(graphemes.map(() => "upright"));
  });

  test.each([
    ["ASCII letters and digits", ["A", "z", "0", "9", "g", "W"]],
    ["ASCII symbols", ["!", "?", ".", ",", "-", "(", "@", "#", "'", '"', "/", "~"]],
    ["the ASCII space", [" "]],
    ["dashes and ellipses", ["…", "‥", "―", "–"]],
    ["Latin-1 letters", ["é", "ñ", "e\u{0301}"]],
    ["Greek and Cyrillic", ["Ω", "Ж"]],
    // 正立だと WebKit だけが縦組用の半角字形に置き換えて幅が変わるので、倒すほうが両エンジンで一致する
    [
      "halfwidth katakana and punctuation",
      ["ｱ", "ｶ\u{FF9E}", "ﾊ\u{FF9F}", "ｰ", "｡", "｢", "｣", "､", "･"],
    ],
  ] as const)("lays %s sideways", (_, graphemes) => {
    const orientations = graphemes.map((grapheme) => GlyphOrientation.of(grapheme, "mixed"));

    expect(orientations).toEqual(graphemes.map(() => "sideways"));
  });

  test("lets the base character decide a grapheme with a text presentation selector", () => {
    const orientation = GlyphOrientation.of("#\u{FE0E}", "mixed");

    expect(orientation).toBe("sideways");
  });

  test("rejects an empty grapheme", () => {
    const resolve = () => GlyphOrientation.of("", "mixed");

    expect(resolve).toThrow(RangeError);
  });
});

describe("GlyphOrientation.of with a pinned presentation", () => {
  test.each(["upright", "sideways"] as const)("keeps %s regardless of the character", (pinned) => {
    const orientations = ["A", "あ", "ｱ", "“"].map((grapheme) =>
      GlyphOrientation.of(grapheme, pinned),
    );

    expect(orientations).toEqual([pinned, pinned, pinned, pinned]);
  });
});

test("is exported from the plugin entry", () => {
  const exported = PublicGlyphOrientation;

  expect(exported).toBe(GlyphOrientation);
});
