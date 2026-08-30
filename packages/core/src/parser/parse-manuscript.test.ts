import { describe, expect, test } from "vite-plus/test";

import { ManuscriptRange } from "../range/manuscript-range";
import { ManuscriptResult } from "../result/manuscript-result";
import { kakuyomuParser } from "./kakuyomu-parser";
import type { ManuscriptParser } from "./manuscript-parser";
import { parseManuscript } from "./parse-manuscript";
import type { ParsedManuscript } from "./parsed-manuscript";
import { pixivParser } from "./pixiv-parser";
import { plainTextParser } from "./plain-text-parser";

describe("parseManuscript", () => {
  test("uses the plain text parser by default and preserves UTF-16 mappings", () => {
    const result = parseManuscript("A😀\r\n家");

    expect.assert(result.ok, "expected parseManuscript to succeed");
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

    expect.assert(result.ok, "expected parseManuscript to succeed");
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
        reading: { kind: "group", text: "かんじ" },
        range: {
          source: { start: 9, end: source.length },
          display: { start: 5, end: 7 },
          graphemes: { start: 3, end: 5 },
        },
      },
    ]);
  });

  test("normalizes Kakuyomu explicit and implicit ruby plus emphasis", () => {
    const source = "😀冴えない彼女《ヒロイン》の｜etc《えとせとら》と《《強調》》";
    const result = parseManuscript(source, { parser: kakuyomuParser });

    expect.assert(result.ok, "expected parseManuscript to succeed");
    expect(result.warnings).toEqual([]);
    expect(result.value.displayText).toBe("😀冴えない彼女のetcと強調");
    expect(result.value.annotations).toEqual([
      {
        kind: "ruby",
        reading: { kind: "group", text: "ヒロイン" },
        range: {
          source: { start: 6, end: 14 },
          display: { start: 6, end: 8 },
          graphemes: { start: 5, end: 7 },
        },
      },
      {
        kind: "ruby",
        reading: { kind: "group", text: "えとせとら" },
        range: {
          source: { start: 15, end: 26 },
          display: { start: 9, end: 12 },
          graphemes: { start: 8, end: 11 },
        },
      },
      {
        kind: "emphasis",
        mark: "・",
        range: {
          source: { start: 27, end: 33 },
          display: { start: 13, end: 15 },
          graphemes: { start: 12, end: 14 },
        },
      },
    ]);
  });

  test("recovers invalid Kakuyomu notation and honours its literal escape", () => {
    const source = "｜《漢字《》\r\n漢字《かんじ\n《《傍点";
    const result = parseManuscript(source, { parser: kakuyomuParser });

    expect.assert(result.ok, "expected parseManuscript to succeed");
    expect(result.value.displayText).toBe("《漢字《》\r\n漢字《かんじ\n《《傍点");
    expect(result.warnings).toHaveLength(3);
    expect(result.warnings.map(({ origin, severity }) => [origin, severity])).toEqual([
      [{ kind: "parser", id: "kg/kakuyomu" }, "warning"],
      [{ kind: "parser", id: "kg/kakuyomu" }, "warning"],
      [{ kind: "parser", id: "kg/kakuyomu" }, "warning"],
    ]);
  });

  test("enforces Kakuyomu ruby length limits while accepting the half-width marker", () => {
    const maximumBase = "漢".repeat(20);
    const maximumReading = "あ".repeat(50);
    const tooLongBase = "漢".repeat(21);
    const source = `${maximumBase}《${maximumReading}》|ABC《えーびーしー》${tooLongBase}《よみ》`;
    const result = parseManuscript(source, { parser: kakuyomuParser });

    expect.assert(result.ok, "expected parseManuscript to succeed");
    expect(result.value.displayText).toBe(`${maximumBase}ABC${tooLongBase}《よみ》`);
    expect(result.value.annotations).toEqual([
      {
        kind: "ruby",
        reading: { kind: "group", text: maximumReading },
        range: {
          source: { start: 0, end: 72 },
          display: { start: 0, end: 20 },
          graphemes: { start: 0, end: 20 },
        },
      },
      {
        kind: "ruby",
        reading: { kind: "group", text: "えーびーしー" },
        range: {
          source: { start: 72, end: 84 },
          display: { start: 20, end: 23 },
          graphemes: { start: 20, end: 23 },
        },
      },
    ]);
    expect(result.warnings).toHaveLength(1);
  });

  test("recovers unknown or malformed Pixiv notation as text with warnings", () => {
    const result = parseManuscript("[unknown:text]\n[b:broken", { parser: pixivParser });

    expect.assert(result.ok, "expected parseManuscript to succeed");
    expect(result.value.displayText).toBe("[unknown:text]\n[b:broken");
    expect(result.warnings.map(({ origin, severity }) => [origin, severity])).toEqual([
      [{ kind: "parser", id: "kg/pixiv" }, "warning"],
      [{ kind: "parser", id: "kg/pixiv" }, "warning"],
    ]);
  });

  test("reports the offending ID when a parser is not namespaced", () => {
    const parser: ManuscriptParser = {
      id: "broken",
      parse: () => ManuscriptResult.succeed(unreachableManuscript()),
    };

    expect(parseManuscript("source", { parser })).toEqual({
      ok: false,
      error: { kind: "InvalidParserId", parserId: "broken" },
    });
  });

  test("rejects a parser result whose source or ranges violate the contract", () => {
    const parser: ManuscriptParser = {
      id: "example/broken",
      parse: () =>
        ManuscriptResult.succeed({
          source: "other",
          displayText: "x",
          graphemes: [],
          annotations: [],
        }),
    };
    const result = parseManuscript("source", { parser });

    expect.assert(result.ok === false, "expected parseManuscript to report a failure");
    expect(result.error.kind).toBe("InvalidParserOutput");
  });

  test.each([
    ["mono", ["かん", "じ"]],
    ["jukugo", ["かん", "じ"]],
  ] as const)("accepts explicit %s ruby associations", (kind, segments) => {
    const base = parseManuscript("漢字");
    expect.assert(base.ok, "fixture did not parse");
    const range = ManuscriptRange.merge(base.value.graphemes.map(({ range }) => range));
    expect.assert(range !== null, "fixture did not contain a ruby base range");
    const parser: ManuscriptParser = {
      id: `example/${kind}`,
      parse: () =>
        ManuscriptResult.succeed<ParsedManuscript>({
          ...base.value,
          annotations: [{ kind: "ruby", range, reading: { kind, segments } }],
        } satisfies ParsedManuscript),
    };

    const result = parseManuscript("漢字", { parser });

    expect.assert(result.ok, `expected ${kind} ruby to satisfy the parser contract`);
    expect(result.value.annotations[0]).toMatchObject({ reading: { kind, segments } });
  });

  test("rejects ruby segments that do not map one-to-one to their base", () => {
    const base = parseManuscript("漢字");
    expect.assert(base.ok, "fixture did not parse");
    const range = ManuscriptRange.merge(base.value.graphemes.map(({ range }) => range));
    expect.assert(range !== null, "fixture did not contain a ruby base range");
    const parser: ManuscriptParser = {
      id: "example/broken-ruby",
      parse: () =>
        ManuscriptResult.succeed<ParsedManuscript>({
          ...base.value,
          annotations: [
            {
              kind: "ruby",
              range,
              reading: { kind: "mono", segments: ["かんじ"] },
            },
          ],
        } satisfies ParsedManuscript),
    };

    const result = parseManuscript("漢字", { parser });

    expect.assert(result.ok === false, "expected the parser contract to reject invalid ruby");
    expect(result.error.kind).toBe("InvalidParserOutput");
  });

  test("surfaces a parser's own refusal as a rejection carrying its reason", () => {
    const parser: ManuscriptParser = {
      id: "example/refuses",
      parse: () => ManuscriptResult.fail({ reason: "この記法には対応していません" }),
    };

    expect(parseManuscript("source", { parser })).toEqual({
      ok: false,
      error: {
        kind: "ParserRejected",
        parserId: "example/refuses",
        reason: "この記法には対応していません",
      },
    });
  });

  test("turns a throwing parser into a typed error instead of propagating the throw", () => {
    const failure = new Error("boom");
    const parser: ManuscriptParser = {
      id: "example/throws",
      parse: () => {
        throw failure;
      },
    };

    expect(parseManuscript("source", { parser })).toEqual({
      ok: false,
      error: { kind: "ParserThrew", parserId: "example/throws", cause: failure },
    });
  });

  test("exports the built-in plain parser through the public parser contract", () => {
    expect(parseManuscript("text", { parser: plainTextParser })).toEqual(parseManuscript("text"));
  });
});

/**
 * The parser under test never runs; only its ID is inspected.
 */
function unreachableManuscript() {
  return { source: "", displayText: "", graphemes: [], annotations: [] };
}
