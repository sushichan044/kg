import { describe, expect, test } from "vite-plus/test";

import { pixivNotation, plainTextNotation } from "./notation";

describe("plainTextNotation", () => {
  test("preserves text and maps every grapheme to its UTF-16 ranges", () => {
    const source = "A😀\r\n家";

    expect(plainTextNotation.parse(source)).toEqual({
      text: source,
      graphemes: [
        { grapheme: "A", textRange: { start: 0, end: 1 }, sourceRange: { start: 0, end: 1 } },
        { grapheme: "😀", textRange: { start: 1, end: 3 }, sourceRange: { start: 1, end: 3 } },
        {
          grapheme: "\r\n",
          textRange: { start: 3, end: 5 },
          sourceRange: { start: 3, end: 5 },
        },
        { grapheme: "家", textRange: { start: 5, end: 6 }, sourceRange: { start: 5, end: 6 } },
      ],
      annotations: [],
    });
  });
});

describe("pixivNotation", () => {
  test("parses the supported pixiv notation into typed annotations", () => {
    const source = "[[rb:漢字 > かんじ]][b:太字][i:斜体][[emphasismark:強調>・]]";
    const parsed = pixivNotation.parse(source);

    expect(parsed.text).toBe("漢字太字斜体強調");
    expect(parsed.annotations).toEqual([
      {
        kind: "ruby",
        reading: "かんじ",
        graphemeRange: { start: 0, end: 2 },
        sourceRange: { start: 0, end: "[[rb:漢字 > かんじ]]".length },
      },
      {
        kind: "bold",
        graphemeRange: { start: 2, end: 4 },
        sourceRange: {
          start: "[[rb:漢字 > かんじ]]".length,
          end: "[[rb:漢字 > かんじ]][b:太字]".length,
        },
      },
      {
        kind: "italic",
        graphemeRange: { start: 4, end: 6 },
        sourceRange: {
          start: "[[rb:漢字 > かんじ]][b:太字]".length,
          end: "[[rb:漢字 > かんじ]][b:太字][i:斜体]".length,
        },
      },
      {
        kind: "emphasis",
        mark: "・",
        graphemeRange: { start: 6, end: 8 },
        sourceRange: {
          start: source.indexOf("[[emphasismark:"),
          end: source.length,
        },
      },
    ]);
  });

  test("maps displayed graphemes to source and display UTF-16 ranges", () => {
    const source = "😀[b:𠮷野]終";
    const parsed = pixivNotation.parse(source);

    expect(parsed.text).toBe("😀𠮷野終");
    expect(parsed.graphemes).toEqual([
      { grapheme: "😀", textRange: { start: 0, end: 2 }, sourceRange: { start: 0, end: 2 } },
      { grapheme: "𠮷", textRange: { start: 2, end: 4 }, sourceRange: { start: 5, end: 7 } },
      { grapheme: "野", textRange: { start: 4, end: 5 }, sourceRange: { start: 7, end: 8 } },
      { grapheme: "終", textRange: { start: 5, end: 6 }, sourceRange: { start: 9, end: 10 } },
    ]);
    expect(parsed.annotations).toEqual([
      {
        kind: "bold",
        graphemeRange: { start: 1, end: 3 },
        sourceRange: { start: 2, end: 9 },
      },
    ]);
  });

  test.each([
    ["unknown", "[unknown:text]"],
    ["malformed", "[b:text"],
    ["empty", "[i:]"],
    ["nested", "[b:outer[i:inner]text]"],
    ["ruby without reading", "[[rb:base > ]]"],
    ["ruby with nested notation", "[[rb:[b:base] > reading]]"],
    ["emphasis with a multi-grapheme mark", "[[emphasismark:text>・・]]"],
  ])("treats %s notation as literal text", (_description, source) => {
    expect(pixivNotation.parse(source)).toEqual(plainTextNotation.parse(source));
  });

  test("does not parse notation across a line break and resumes on the next line", () => {
    const source = "[b:first\nline]\n[b:second]";
    const parsed = pixivNotation.parse(source);

    expect(parsed.text).toBe("[b:first\nline]\nsecond");
    expect(parsed.annotations).toEqual([
      {
        kind: "bold",
        graphemeRange: { start: 15, end: 21 },
        sourceRange: { start: 15, end: 25 },
      },
    ]);
  });

  test("keeps HTML-looking content as an ordinary string", () => {
    const source = "[b:<img src=x onerror=alert(1)>]";
    const parsed = pixivNotation.parse(source);

    expect(parsed.text).toBe("<img src=x onerror=alert(1)>");
    expect(parsed.graphemes.map(({ grapheme }) => grapheme).join("")).toBe(parsed.text);
  });

  test("accepts exactly one grapheme as an emphasis mark", () => {
    const source = "[[emphasismark:星>⭐︎]]";
    const parsed = pixivNotation.parse(source);

    expect(parsed.text).toBe("星");
    expect(parsed.annotations).toEqual([
      {
        kind: "emphasis",
        mark: "⭐︎",
        graphemeRange: { start: 0, end: 1 },
        sourceRange: { start: 0, end: source.length },
      },
    ]);
  });
});
