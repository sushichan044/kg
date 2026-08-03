import { describe, expect, test } from "vite-plus/test";

import { parseManuscript, pixivParser, plainTextParser } from "./notation";

describe("parseManuscript", () => {
  test("uses the plain text parser by default and preserves UTF-16 mappings", () => {
    const result = parseManuscript("A😀\r\n家");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual({
      source: "A😀\r\n家",
      displayText: "A😀\r\n家",
      graphemes: [
        {
          value: "A",
          range: {
            source: { start: 0, end: 1 },
            display: { start: 0, end: 1 },
            graphemes: { start: 0, end: 1 },
          },
        },
        {
          value: "😀",
          range: {
            source: { start: 1, end: 3 },
            display: { start: 1, end: 3 },
            graphemes: { start: 1, end: 2 },
          },
        },
        {
          value: "\r\n",
          range: {
            source: { start: 3, end: 5 },
            display: { start: 3, end: 5 },
            graphemes: { start: 2, end: 3 },
          },
        },
        {
          value: "家",
          range: {
            source: { start: 5, end: 6 },
            display: { start: 5, end: 6 },
            graphemes: { start: 3, end: 4 },
          },
        },
      ],
      annotations: [],
    });
  });

  test("normalizes Pixiv annotations and keeps all three ranges", () => {
    const source = "😀[b:𠮷野][[rb:漢字>かんじ]]";
    const result = parseManuscript(source, { parser: pixivParser });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.displayText).toBe("😀𠮷野漢字");
    expect(result.value.annotations).toEqual([
      {
        kind: "bold",
        range: {
          source: { start: 2, end: 9 },
          display: { start: 2, end: 5 },
          graphemes: { start: 1, end: 3 },
        },
      },
      {
        kind: "ruby",
        reading: "かんじ",
        range: {
          source: { start: 9, end: source.length },
          display: { start: 5, end: 7 },
          graphemes: { start: 3, end: 5 },
        },
      },
    ]);
  });

  test("recovers unknown or malformed Pixiv notation as text with warnings", () => {
    const result = parseManuscript("[unknown:text]\n[b:broken", { parser: pixivParser });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.displayText).toBe("[unknown:text]\n[b:broken");
    expect(result.warnings.map(({ origin, severity }) => [origin, severity])).toEqual([
      [{ kind: "parser", id: "kg/pixiv" }, "warning"],
      [{ kind: "parser", id: "kg/pixiv" }, "warning"],
    ]);
  });

  test("rejects a parser result whose source or ranges violate the contract", () => {
    const result = parseManuscript("source", {
      parser: {
        id: "example/broken",
        parse: () => ({
          ok: true,
          warnings: [],
          value: { source: "other", displayText: "x", graphemes: [], annotations: [] },
        }),
      },
    });

    expect(result).toMatchObject({ ok: false, errors: [{ stage: "parse" }] });
  });

  test("exports the built-in plain parser through the public parser contract", () => {
    expect(parseManuscript("text", { parser: plainTextParser })).toEqual(parseManuscript("text"));
  });
});
