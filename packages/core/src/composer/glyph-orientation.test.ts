import { describe, expect, test } from "vite-plus/test";

import { resolveGlyphOrientation } from "./glyph-orientation";

const upright = [
  ["hiragana", "あ"],
  ["katakana", "ア"],
  ["kanji", "漢"],
  ["ideographic comma", "、"],
  ["ideographic full stop", "。"],
  ["corner bracket open", "「"],
  ["corner bracket close", "」"],
  ["prolonged sound mark", "ー"],
  ["curly double quote", "“"],
  ["curly double quote close", "”"],
  ["ideographic space", "　"],
  ["fullwidth letter", "Ａ"],
  ["fullwidth digit", "１"],
  ["fullwidth exclamation", "！"],
  ["fullwidth left parenthesis", "（"],
  ["CJK extension B", "𠮷"],
  ["emoji", "😀"],
  ["emoji with selector", "❤️"],
  ["digit emoji keycap", "1️⃣"],
  ["hash emoji keycap", "#️⃣"],
] as const;

const sideways = [
  ["ASCII letter", "A"],
  ["ASCII lowercase", "a"],
  ["ASCII digit", "1"],
  ["ASCII space", " "],
  ["em dash", "—"],
  ["horizontal bar", "―"],
  ["bullet", "•"],
  ["horizontal ellipsis", "…"],
  ["halfwidth katakana", "ｱ"],
  ["halfwidth prolonged sound mark", "ｰ"],
  ["halfwidth corner bracket", "｢"],
  ["fullwidth hyphen-minus", "－"],
  ["bare keycap combining mark", "1⃣"],
] as const;

describe("resolveGlyphOrientation", () => {
  describe("mixed", () => {
    test.for(upright)("draws %s upright", ([, grapheme]) => {
      // Arrange
      const presentation = "mixed";

      // Act
      const orientation = resolveGlyphOrientation(grapheme, presentation);

      // Assert
      expect(orientation).toBe("upright");
    });

    test.for(sideways)("draws %s sideways", ([, grapheme]) => {
      // Arrange
      const presentation = "mixed";

      // Act
      const orientation = resolveGlyphOrientation(grapheme, presentation);

      // Assert
      expect(orientation).toBe("sideways");
    });

    test("rejects an empty grapheme", () => {
      // Arrange & Act & Assert
      expect(() => resolveGlyphOrientation("", "mixed")).toThrow(RangeError);
    });
  });

  test.for(["あ", "A", "😀"])("keeps upright presentation for %s", (grapheme) => {
    // Arrange & Act
    const orientation = resolveGlyphOrientation(grapheme, "upright");

    // Assert
    expect(orientation).toBe("upright");
  });

  test.for(["あ", "A", "😀"])("keeps sideways presentation for %s", (grapheme) => {
    // Arrange & Act
    const orientation = resolveGlyphOrientation(grapheme, "sideways");

    // Assert
    expect(orientation).toBe("sideways");
  });
});
