import * as v from "valibot";
import { describe, expect, test } from "vite-plus/test";

import { kakuyomuParser } from "../parser/kakuyomu-parser";
import type { ManuscriptParser } from "../parser/manuscript-parser";
import { parseManuscript } from "../parser/parse-manuscript";
import type { ParsedManuscript } from "../parser/parsed-manuscript";
import { pixivParser } from "../parser/pixiv-parser";
import { ManuscriptRange } from "../range/manuscript-range";
import { ManuscriptResult } from "../result/manuscript-result";
import { composeManuscript } from "./compose-manuscript";
import { NovelCompositionSettings } from "./composition-settings";
import type { ManuscriptComposer } from "./manuscript-composer";
import type { NovelComposedManuscript } from "./novel-composer";
import { createNovelComposer, novelComposer } from "./novel-composer";
import type { NovelLine } from "./novel-line";
import { logicalRunMeasurer } from "./run-measurer";

function lineGlyphs(line: NovelLine) {
  return line.items.filter((item) => item.kind === "glyph" || item.kind === "combined-glyph");
}

function suppressedItems(line: NovelLine) {
  return line.items.filter((item) => item.kind === "suppressed");
}

function parsed(source: string) {
  const result = parseManuscript(source);
  expect.assert(result.ok, "fixture did not parse");
  return result.value;
}

function settings(patch: Partial<NovelCompositionSettings["flow"]> = {}): NovelCompositionSettings {
  return NovelCompositionSettings.forPaper("a4", {
    ...NovelCompositionSettings.defaults,
    flow: {
      lineLengthEm: 10,
      linesPerStage: 10,
      stagesPerPage: 1,
      ...patch,
    },
  });
}

function lineText(line: NovelLine): string {
  return line.items
    .flatMap((item) =>
      item.kind === "glyph" ||
      item.kind === "combined-glyph" ||
      (item.kind === "glue" && item.origin === "source")
        ? [item.value]
        : [],
    )
    .join("");
}

function contentLines(result: NovelComposedManuscript) {
  return result.layout.pages.flatMap(({ stages }) =>
    stages.flatMap(({ lines }) => lines.filter(({ range }) => range !== null)),
  );
}

type LabelLayout = { label: string };

const labelComposer = (
  id: string,
  label: (prefix: string, displayText: string) => LabelLayout,
): ManuscriptComposer<{ prefix: string }, LabelLayout> => ({
  id,
  settingsSchema: v.object({ prefix: v.string() }),
  layoutSchema: v.object({ label: v.string() }),
  compose: (manuscript, value) =>
    ManuscriptResult.succeed(label(value.prefix, manuscript.displayText)),
});

const lyingLabel = (): LabelLayout => ({ label: 1 }) as unknown as LabelLayout;

describe("composeManuscript", () => {
  test.each([
    { mark: "。", advanceScale: 1 },
    { mark: "、", advanceScale: 1 },
    { mark: "。", advanceScale: 1.0004 },
    { mark: "、", advanceScale: 1.0004 },
    { mark: "。", advanceScale: 0.9996 },
    { mark: "、", advanceScale: 0.9996 },
  ])(
    "keeps A6 sentences compact with $mark at width scale $advanceScale",
    ({ mark, advanceScale }) => {
      const source = `　だがしかし${mark}今日の私の心はまるで芽吹きを迎えた若葉のよう。華金だから？　それはもちろんそうだ。私とて管理職である以前に社会人なのだから、大切な人と過ごす休日のために働いていると言っても過言ではない。仕事のきりがいいから？　これは大いにその通り。`;
      // ブラウザのフォントメトリクスは、論理上の全角の送り幅とわずかに異なることがある。
      const composer = createNovelComposer({
        measurer: (request) => {
          const measured = logicalRunMeasurer(request);
          return { ...measured, advanceEm: measured.advanceEm * advanceScale };
        },
      });

      const result = composeManuscript(parsed(source), {
        composer,
        settings: NovelCompositionSettings.forPaper("a6", NovelCompositionSettings.defaults),
      });

      expect.assert(result.ok);
      const lines = contentLines(result.value);
      const firstLine = lines[0];
      expect.assert(firstLine !== undefined);

      expect(lineText(firstLine)).toContain(`だがしかし${mark}今日の私の心は`);
      expect(lines.map(lineText).join("")).toBe(source);
      for (const line of lines) {
        expect(line.break.kind).not.toBe("forced");
        for (const item of line.items.filter((item) => item.kind === "glue")) {
          expect(item.widthEm - item.naturalWidthEm).toBeLessThanOrEqual(0.25 + 1e-9);
        }
      }
    },
  );
  test.each(["――", "——", "──", "……", "‥‥", "〳〵", "〴〵"])(
    "keeps %s together at a potential line boundary",
    (marks) => {
      const source = "あ".repeat(9) + marks + "あ".repeat(9);

      const result = composeManuscript(parsed(source), {
        composer: novelComposer,
        settings: settings(),
      });

      expect.assert(result.ok);
      const lines = contentLines(result.value);
      const ends = lines.map((line) => {
        expect.assert(line.range !== null);
        return line.range.graphemes.end;
      });
      expect(lines.map(lineText).join("")).toBe(source);
      expect(ends).not.toContain(10);
    },
  );

  test.each(["―…", "…‥", "―—", "—─", "〵〳"])(
    "allows a line break between the different marks in %s",
    (marks) => {
      const source = "あ".repeat(9) + marks + "あ".repeat(9);

      const result = composeManuscript(parsed(source), {
        composer: novelComposer,
        settings: settings(),
      });

      expect.assert(result.ok);
      expect(contentLines(result.value).map(lineText)).toEqual([
        "あ".repeat(9) + marks.slice(0, 1),
        marks.slice(1) + "あ".repeat(9),
      ]);
    },
  );

  test("returns a self-contained positioned novel snapshot", () => {
    const source = "あいうえおかきくけこさし";
    const result = composeManuscript(parsed(source), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    expect(result.value.composerId).toBe("kg/novel");
    expect(result.value.settings).toEqual(settings());
    expect(result.value.parsed.source).toBe(source);

    const lines = contentLines(result.value);
    expect(lines.map(lineText)).toEqual(["あいうえおかきくけこ", "さし"]);
    const secondLine = lines[1];
    expect.assert(secondLine !== undefined, "layout has no second content line");
    const firstGrapheme = lineGlyphs(secondLine)[0];
    expect.assert(firstGrapheme !== undefined, "second content line has no first grapheme");
    expect(firstGrapheme).toMatchObject({
      kind: "glyph",
      value: "さ",
      layoutSpan: { offsetEm: 0, advanceEm: 1 },
      renderSpan: { offsetEm: 0, advanceEm: 1 },
      disposition: "placed",
      range: { source: { start: 10, end: 11 } },
    });
    expect(globalThis.structuredClone(result.value)).toEqual(result.value);
  });

  test("keeps standalone dotted abbreviation letters upright while retaining periods", () => {
    const result = composeManuscript(parsed("U.S."), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const line = contentLines(result.value)[0];
    expect.assert(line !== undefined, "layout has no content line");
    expect(lineGlyphs(line).map(({ value, presentation }) => ({ value, presentation }))).toEqual([
      { value: "U", presentation: "upright" },
      { value: ".", presentation: "mixed" },
      { value: "S", presentation: "upright" },
      { value: ".", presentation: "mixed" },
    ]);
    expect(lineText(line)).toBe("U.S.");
  });

  test("lays out a western sentence with sideways initials and word spaces", () => {
    const result = composeManuscript(parsed("I love you"), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const line = contentLines(result.value)[0];
    expect.assert(line !== undefined, "layout has no content line");
    expect(lineGlyphs(line).every(({ presentation }) => presentation === "sideways")).toBe(true);
    expect(line.inlineSizeEm).toBeCloseTo(4 + 2 / 3);
    expect(lineText(line)).toBe("I love you");
  });

  test("wraps a western sentence between words while retaining source spaces", () => {
    const source = "I  love you I love you I love you";
    const result = composeManuscript(parsed(source), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const lines = contentLines(result.value);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map(lineText).join("")).toBe(source);
    for (const line of lines) {
      expect(line.inlineSizeEm).toBeLessThanOrEqual(10);
      expect(lineGlyphs(line).every(({ presentation }) => presentation === "sideways")).toBe(true);
      expect(
        lineText(line)
          .trim()
          .split(/ +/u)
          .every((word) => ["I", "love", "you"].includes(word)),
      ).toBe(true);
    }
    const firstLine = lines[0];
    expect.assert(firstLine !== undefined, "layout has no first line");
    const lastItem = firstLine.items.at(-1);
    expect(lastItem).toMatchObject({ kind: "glue", origin: "source", value: " ", widthEm: 0 });
  });

  test.each([
    { source: "「I ｜love《ラヴ》 you!」", parser: kakuyomuParser },
    { source: "「I [[rb:love>ラヴ]] you!」", parser: pixivParser },
  ])("keeps an annotated word sideways in $source", ({ source, parser }) => {
    const manuscript = parseManuscript(source, { parser });
    expect.assert(manuscript.ok, "fixture did not parse");

    const result = composeManuscript(manuscript.value, {
      composer: novelComposer,
      settings: settings({ lineLengthEm: 40 }),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const lines = contentLines(result.value);
    expect(lines.map(lineText).join("")).toBe(manuscript.value.displayText);
    const glyphs = lines.flatMap(lineGlyphs);
    expect(
      glyphs
        .filter(({ value }) => /^[!-~]+$/u.test(value))
        .every(({ presentation }) => presentation === "sideways"),
    ).toBe(true);
    for (const glyph of glyphs) {
      expect(
        manuscript.value.displayText.slice(glyph.range.display.start, glyph.range.display.end),
      ).toBe(glyph.value);
    }
    expect(
      lines.flatMap(({ annotations }) => annotations).filter(({ kind }) => kind === "ruby"),
    ).toHaveLength(1);
  });

  test.each(["I'm happy!", "STR 10", "I love 12!?", '"I love you!"', "I live in the U.S."])(
    "keeps ASCII punctuation and numbers in %s within sideways words",
    (source) => {
      const result = composeManuscript(parsed(source), {
        composer: novelComposer,
        settings: settings({ lineLengthEm: 40 }),
      });

      expect.assert(result.ok, "expected composition to succeed");
      const lines = contentLines(result.value);
      expect(lines.map(lineText).join("")).toBe(source);
      expect(
        lines.flatMap(lineGlyphs).every(({ presentation }) => presentation === "sideways"),
      ).toBe(true);
      expect(
        lines
          .flatMap(({ items }) => items)
          .filter((item) => item.kind === "glue" && item.origin === "generated")
          .every((item) => item.widthEm === 0),
      ).toBe(true);
    },
  );

  test("models JLReq vertical presentations before positioning text", () => {
    const result = composeManuscript(parsed("あBGMいWebうeditorえ12おＷ"), {
      composer: novelComposer,
      settings: settings({ lineLengthEm: 20 }),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const line = contentLines(result.value)[0];
    expect.assert(line !== undefined, "layout has no content line");
    expect(
      lineGlyphs(line).map(({ value, layoutSpan, presentation }) => ({
        value,
        advanceEm: layoutSpan.advanceEm,
        presentation,
      })),
    ).toEqual([
      { value: "あ", advanceEm: 1, presentation: "mixed" },
      { value: "B", advanceEm: 1, presentation: "upright" },
      { value: "G", advanceEm: 1, presentation: "upright" },
      { value: "M", advanceEm: 1, presentation: "upright" },
      { value: "い", advanceEm: 1, presentation: "mixed" },
      { value: "W", advanceEm: 1, presentation: "upright" },
      { value: "e", advanceEm: 1, presentation: "upright" },
      { value: "b", advanceEm: 1, presentation: "upright" },
      { value: "う", advanceEm: 1, presentation: "mixed" },
      { value: "e", advanceEm: 0.5, presentation: "sideways" },
      { value: "d", advanceEm: 0.5, presentation: "sideways" },
      { value: "i", advanceEm: 0.5, presentation: "sideways" },
      { value: "t", advanceEm: 0.5, presentation: "sideways" },
      { value: "o", advanceEm: 0.5, presentation: "sideways" },
      { value: "r", advanceEm: 0.5, presentation: "sideways" },
      { value: "え", advanceEm: 1, presentation: "mixed" },
      { value: "12", advanceEm: 1, presentation: "tate-chu-yoko" },
      { value: "お", advanceEm: 1, presentation: "mixed" },
      { value: "Ｗ", advanceEm: 1, presentation: "upright" },
    ]);
  });

  test("moves an unbreakable vertical presentation group to the next line", () => {
    const result = composeManuscript(parsed(`${"あ".repeat(9)}BGM`), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    expect(contentLines(result.value).map(lineText)).toEqual(["あ".repeat(9), "BGM"]);
  });

  test("keeps an oversized Western word unbroken on its own line", () => {
    const word = "abcdefghijklmnopqrstuv";
    const result = composeManuscript(parsed(`あ${word}い`), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    expect(contentLines(result.value).map(lineText)).toEqual(["あ", word, "い"]);
  });

  test("emits annotation fragments instead of asking the viewer to infer them", () => {
    const parseResult = parseManuscript("[b:太字][[rb:漢字>かんじ]]", { parser: pixivParser });
    expect.assert(parseResult.ok, "fixture did not parse");

    const result = composeManuscript(parseResult.value, {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const line = contentLines(result.value)[0];
    expect.assert(line !== undefined, "layout has no content line");
    expect(line.annotations).toMatchObject([
      { kind: "bold", continuation: "whole" },
      {
        kind: "ruby",
        rubyKind: "group",
        reading: "かんじ",
        continuation: "whole",
      },
    ]);
  });

  test.each(["‼", "⁇", "⁈", "⁉"])(
    "places a closing bracket after the full-em box of %s",
    (mark) => {
      const result = composeManuscript(parsed(`「ちゃうんか${mark}」続き`), {
        composer: novelComposer,
        settings: settings({ lineLengthEm: 20 }),
      });

      expect.assert(result.ok, "expected composition to succeed");
      const line = contentLines(result.value)[0];
      expect.assert(line !== undefined, "layout has no content line");
      const glyphs = lineGlyphs(line);
      expect(glyphs.slice(6, 9)).toMatchObject([
        {
          value: mark,
          layoutSpan: { offsetEm: 6, advanceEm: 1 },
          renderSpan: { offsetEm: 6, advanceEm: 1 },
          range: { source: { start: 6, end: 7 } },
        },
        { value: "」", layoutSpan: { offsetEm: 7, advanceEm: 0.5 } },
        { value: "続", layoutSpan: { offsetEm: 8, advanceEm: 1 } },
      ]);
    },
  );

  test.each(["‼", "⁇", "⁈", "⁉"])(
    "keeps %s and its closing bracket together at a wrap boundary",
    (mark) => {
      const result = composeManuscript(parsed(`「あいうえおかきくけ${mark}」`), {
        composer: novelComposer,
        settings: settings(),
      });

      expect.assert(result.ok, "expected composition to succeed");
      expect(contentLines(result.value).map(lineText)).toEqual([
        "「あいうえおかきく",
        `け${mark}」`,
      ]);
    },
  );

  test.each(["‼", "⁇", "⁈", "⁉"])(
    "keeps the full-em gap after %s as source glue inside a line",
    (mark) => {
      const result = composeManuscript(parsed(`あ${mark}　続き`), {
        composer: novelComposer,
        settings: settings(),
      });

      expect.assert(result.ok, "expected composition to succeed");
      const line = contentLines(result.value)[0];
      expect.assert(line !== undefined, "layout has no content line");
      expect(lineText(line)).toBe(`あ${mark}　続き`);
      expect(
        line.items.filter((item) => item.kind === "glue" && item.origin === "source"),
      ).toMatchObject([
        { value: "　", offsetEm: 2, widthEm: 1, naturalWidthEm: 1, adjustment: "natural" },
      ]);
    },
  );

  test.each(["‼", "⁇", "⁈", "⁉"])(
    "suppresses the gap after %s when it falls at a wrap boundary",
    (mark) => {
      const result = composeManuscript(parsed(`あいうえおかきくけ${mark}　続き`), {
        composer: novelComposer,
        settings: settings(),
      });

      expect.assert(result.ok, "expected composition to succeed");
      const lines = contentLines(result.value);
      expect(lines.map(lineText)).toEqual([`あいうえおかきくけ${mark}`, "続き"]);
      const secondLine = lines[1];
      expect.assert(secondLine !== undefined, "layout has no second content line");
      expect(suppressedItems(secondLine)).toMatchObject([
        {
          value: "　",
          reason: "question-or-exclamation-gap",
          range: { source: { start: 10, end: 11 } },
        },
      ]);
    },
  );

  test("records a valid question-mark gap as suppressed at a wrap boundary", () => {
    const source = "あいうえおかきく！？　続き";
    const result = composeManuscript(parsed(source), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const lines = contentLines(result.value);
    expect(lines.map(lineText)).toEqual(["あいうえおかきく！？", "続き"]);
    const secondLine = lines[1];
    expect.assert(secondLine !== undefined, "layout has no second content line");
    expect(suppressedItems(secondLine)).toMatchObject([
      {
        kind: "suppressed",
        value: "　",
        reason: "question-or-exclamation-gap",
        range: { source: { start: 10, end: 11 } },
      },
    ]);
    expect(result.value.layout.stats.chars).toBe(13);
  });

  test("keeps a valid question-mark gap as source-backed glue inside a line", () => {
    const result = composeManuscript(parsed("あ！？　続き"), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const line = contentLines(result.value)[0];
    expect.assert(line !== undefined, "layout has no content line");
    expect(lineText(line)).toBe("あ！？　続き");
    expect(
      line.items.filter((item) => item.kind === "glue" && item.origin === "source"),
    ).toMatchObject([
      {
        kind: "glue",
        origin: "source",
        value: "　",
        widthEm: 1,
        naturalWidthEm: 1,
        adjustment: "natural",
      },
    ]);
    expect(suppressedItems(line)).toEqual([]);
  });

  test("keeps a question-mark gap fixed while spreading the final-stage remainder elsewhere", () => {
    const result = composeManuscript(parsed("あ！　？　！　？う……"), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const firstLine = contentLines(result.value)[0];
    expect.assert(firstLine !== undefined, "layout has no first content line");

    expect(lineText(firstLine)).toBe("あ！　？　！　？う");
    expect(firstLine.break).toEqual({ kind: "stretched" });
    expect(firstLine.inlineSizeEm).toBe(10);
    expect(
      firstLine.items.flatMap((item) =>
        item.kind === "glue" && item.origin === "source"
          ? [{ value: item.value, widthEm: item.widthEm, adjustment: item.adjustment }]
          : [],
      ),
    ).toEqual([
      { value: "　", widthEm: 1, adjustment: "natural" },
      { value: "　", widthEm: 1, adjustment: "natural" },
      { value: "　", widthEm: 1, adjustment: "natural" },
    ]);
    expect(
      firstLine.items.flatMap((item) =>
        item.kind === "glue" && item.origin === "generated" && item.adjustment === "stretched"
          ? [item.widthEm]
          : [],
      ),
    ).toEqual([1]);
  });

  describe("tate-chu-yoko exclamation runs across line breaks", () => {
    const marks = (source: string, lineLengthEm: number) => {
      const result = composeManuscript(parsed(source), {
        composer: novelComposer,
        settings: settings({ lineLengthEm }),
      });
      expect.assert(
        result.ok,
        `expected composition to succeed: ${result.ok ? "" : JSON.stringify(result.error)} (${source}, ${lineLengthEm})`,
      );
      return contentLines(result.value).flatMap((line) =>
        line.items.flatMap((item) =>
          item.kind === "glyph" || item.kind === "combined-glyph" ? [item] : [],
        ),
      );
    };

    test.each(
      ["！？", "？？！", "!?", "！！"].flatMap((run) => [
        `${"あ".repeat(10)}${run}いう`,
        `「${"あ".repeat(9)}${run}」いう`,
      ]),
    )("never opens a line with the run in %s, like a single dividing mark", (source) => {
      const result = composeManuscript(parsed(source), {
        composer: novelComposer,
        settings: settings(),
      });
      expect.assert(result.ok, "expected composition to succeed");

      const lineHeads = contentLines(result.value).map((line) =>
        line.items.find((item) => item.kind === "glyph" || item.kind === "combined-glyph"),
      );

      expect(lineHeads.map((item) => item?.kind)).not.toContain("combined-glyph");
    });

    test.each(["！？", "？？！", "!?", "！！"])(
      "never splits %s however the line is broken around it",
      (run) => {
        for (let prefix = 0; prefix <= 25; prefix += 1) {
          for (const lineLengthEm of [10, 11, 12]) {
            const items = marks(`${"あ".repeat(prefix)}${run}いう`, lineLengthEm);

            const combined = items.filter(({ kind }) => kind === "combined-glyph");
            const loose = items.filter(({ value }) => /^[!?！？]$/u.test(value));

            expect(
              combined.map(({ value }) => value),
              `prefix=${prefix} len=${lineLengthEm}`,
            ).toEqual([run]);
            expect(loose, `prefix=${prefix} len=${lineLengthEm}`).toEqual([]);
          }
        }
      },
    );

    test.each(["「", "（", "『"])(
      "never splits a run that follows the opening bracket %s however the line is broken",
      (opening) => {
        for (let prefix = 0; prefix <= 25; prefix += 1) {
          for (const lineLengthEm of [10, 11, 12]) {
            const items = marks(`${"あ".repeat(prefix)}${opening}！？いう`, lineLengthEm);

            const combined = items.filter(({ kind }) => kind === "combined-glyph");
            const loose = items.filter(({ value }) => /^[!?！？]$/u.test(value));

            expect(
              combined.map(({ value }) => value),
              `prefix=${prefix} len=${lineLengthEm}`,
            ).toEqual(["！？"]);
            expect(loose, `prefix=${prefix} len=${lineLengthEm}`).toEqual([]);
          }
        }
      },
    );

    test.each([
      ["「おおお！？」", "！？"],
      ["（えっ？！）", "？！"],
      ["『まさか！！』", "！！"],
      ["「ええ！？」と言った。", "！？"],
      ["「ええ！？　本当に？」", "！？"],
      ["「！？」", "！？"],
      ["「！？そんな」", "！？"],
      ["（？！そんな）", "？！"],
      ["『！！　そんな』", "！！"],
    ])("combines the run in %s next to brackets and spaces", (source, run) => {
      for (const lineLengthEm of [10, 11]) {
        const items = marks(source, lineLengthEm);

        expect(
          items.filter(({ kind }) => kind === "combined-glyph").map(({ value }) => value),
          `len=${lineLengthEm}`,
        ).toEqual([run]);
      }
    });
  });

  test("keeps a trailing suppressed gap in the preceding line range", () => {
    const source = "あいうえおかきく！？　";
    const result = composeManuscript(parsed(source), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const lines = contentLines(result.value);
    expect(lines.map(lineText)).toEqual(["あいうえおかきく！？"]);
    const line = lines[0];
    expect.assert(line !== undefined, "layout has no content line");
    expect(suppressedItems(line)).toMatchObject([
      {
        kind: "suppressed",
        value: "　",
        reason: "question-or-exclamation-gap",
        range: { source: { start: 10, end: 11 } },
      },
    ]);
    expect.assert(line.range !== null, "content line has no range");
    expect(line.range.source).toEqual({ start: 0, end: 11 });
  });

  test("hangs punctuation instead of starting the next line with it", () => {
    const result = composeManuscript(parsed(`${"あ".repeat(10)}。続き`), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const lines = contentLines(result.value);
    expect(lines.map(lineText)).toEqual([`${"あ".repeat(10)}。`, "続き"]);
    const firstLine = lines[0];
    expect.assert(firstLine !== undefined, "layout has no first content line");
    const punctuation = lineGlyphs(firstLine).at(-1);
    expect.assert(punctuation !== undefined, "first content line has no trailing punctuation");
    expect(punctuation.disposition).toBe("hanging");
    expect(firstLine.break).toEqual({ kind: "hanging" });
    expect(punctuation.layoutSpan.advanceEm).toBe(0);
    expect(punctuation.renderSpan.advanceEm).toBe(1);
  });

  test("backs up before punctuation when hanging would expose a closing bracket", () => {
    const result = composeManuscript(parsed("「あいうえおかきくけ。」"), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    expect(contentLines(result.value).map(lineText)).toEqual(["「あいうえおかきく", "け。」"]);
  });

  test("does not treat question marks as hanging punctuation", () => {
    const result = composeManuscript(parsed("「あいうえおかきくけ？」"), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    expect(contentLines(result.value).map(lineText)).toEqual(["「あいうえおかきく", "け？」"]);
  });

  test("shrinks punctuation glue before pushing an inseparable pair to the next line", () => {
    const result = composeManuscript(parsed("あい、うえ、おかき……く"), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const lines = contentLines(result.value);
    expect(lines.map(lineText)).toEqual(["あい、うえ、おかき……", "く"]);
    const firstLine = lines[0];
    expect.assert(firstLine !== undefined, "layout has no first content line");
    expect(firstLine.break).toEqual({ kind: "shrunk" });
    expect(
      firstLine.items.flatMap((item) =>
        item.kind === "glue" && item.adjustment === "shrunk" ? [item.widthEm] : [],
      ),
    ).toEqual([0, 0]);
    const comma = lineGlyphs(firstLine).find(({ value }) => value === "、");
    expect.assert(comma !== undefined, "layout has no comma glyph");
    expect(comma.layoutSpan.advanceEm).toBe(0.5);
    expect(comma.renderSpan.advanceEm).toBe(1);
    expect(firstLine.inlineSizeEm).toBe(10);
  });

  test("drops the invisible line-end half-em before squeezing visible punctuation space", () => {
    // 字詰め10字の行に10字半の文字列を置く。行中の読点で二分、行末でもう二分を詰められる。
    const result = composeManuscript(parsed("ああ、ああああああ。」"), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const lines = contentLines(result.value);
    expect(lines.map(lineText)).toEqual(["ああ、ああああああ。」"]);
    const line = lines[0];
    expect.assert(line !== undefined, "layout has no content line");
    expect(line.break).toEqual({ kind: "shrunk" });
    expect(
      line.items.flatMap((item) =>
        item.kind === "glue" && item.naturalWidthEm === 0.5
          ? [{ widthEm: item.widthEm, adjustment: item.adjustment }]
          : [],
      ),
    ).toEqual([
      // 読点の後ろの二分は幅を保ち、代わりに行末の見えない二分がなくなる。
      { widthEm: 0.5, adjustment: "natural" },
      { widthEm: 0, adjustment: "shrunk" },
    ]);
    expect(line.inlineSizeEm).toBe(10);
  });

  test("opens up only the pairs 表6 admits when a line falls short", () => {
    // 2倍リーダは分割できず、単独で2行目の行頭にも置けない。そのため許される分割位置は一つだけで、
    // 1行目は全角1字分足りなくなる。
    const result = composeManuscript(parsed("「あああああああ、……"), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const lines = contentLines(result.value);
    expect(lines.map(lineText)).toEqual(["「あああああああ、", "……"]);
    const firstLine = lines[0];
    expect.assert(firstLine !== undefined, "layout has no first content line");
    expect(firstLine.break).toEqual({ kind: "stretched" });
    const glues = firstLine.items.flatMap((item) =>
      item.kind === "glue"
        ? [{ naturalWidthEm: item.naturalWidthEm, adjustment: item.adjustment }]
        : [],
    );
    // 行頭の二分と、行末で読点が取る二分は幅を保つ。JLReq はどちらも空けないので、
    // 全角1字分の不足は仮名同士の字間だけで埋める。
    expect(glues.filter(({ naturalWidthEm }) => naturalWidthEm === 0.5)).toEqual([
      { naturalWidthEm: 0.5, adjustment: "natural" },
      { naturalWidthEm: 0.5, adjustment: "natural" },
    ]);
    expect(
      glues
        .filter(({ adjustment }) => adjustment === "stretched")
        .map(({ naturalWidthEm }) => naturalWidthEm),
    ).not.toContain(0.5);
  });

  test("sets a western word space on a third em, as an アキ rather than a box", () => {
    const result = composeManuscript(parsed("あspring rainい"), {
      composer: novelComposer,
      settings: settings({ lineLengthEm: 40 }),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const line = contentLines(result.value)[0];
    expect.assert(line !== undefined, "layout has no content line");

    expect(
      line.items.flatMap((item) =>
        item.kind === "glue" && item.origin === "source"
          ? [{ value: item.value, widthEm: item.widthEm, adjustment: item.adjustment }]
          : [],
      ),
    ).toEqual([{ value: " ", widthEm: 1 / 3, adjustment: "natural" }]);
    // 漢字、四分、横倒しの欧字6字、欧文間隔、さらに欧字4字、四分、漢字の順に並ぶ。
    // 欧文間隔は自身のボックスを持たない。
    expect(line.inlineSizeEm).toBe(1 + 0.25 + 3 + 1 / 3 + 2 + 0.25 + 1);
  });

  test("takes a western word space at the line end to nothing", () => {
    // 表1 注13 により、行頭と行末の欧文間隔は幅を持たない。そのアキは版面の外に出てしまうからだ。
    const result = composeManuscript(parsed("ああああああああab cd"), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const lines = contentLines(result.value);
    // 欧文間隔はそれで終わる行に残り、取り除かずに幅0として報告する。
    expect(lines.map(lineText)).toEqual(["ああああああああab ", "cd"]);
    const firstLine = lines[0];
    expect.assert(firstLine !== undefined, "layout has no first content line");

    expect(
      firstLine.items.flatMap((item) =>
        item.kind === "glue" && item.origin === "source" ? [item.widthEm] : [],
      ),
    ).toEqual([0]);
  });

  test("opens a western word space to its half em before any other stage", () => {
    // JLReq 3.8.4 a は欧文間隔を最初に空ける。
    // この行の不足はどの段階でも単独では吸収しきれないので、
    // 第1段階で欧文間隔を三分アキから上限の二分アキまで空け、
    // 第2段階で欧字との間の四分を二分まで空け、その残りだけが仮名同士の字間に回る。
    const result = composeManuscript(parsed("あああああab cdい……"), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const firstLine = contentLines(result.value)[0];
    expect.assert(firstLine !== undefined, "layout has no first content line");
    expect(firstLine.break).toEqual({ kind: "stretched" });

    const wordSpace = firstLine.items.find(
      (item) => item.kind === "glue" && item.origin === "source",
    );
    expect.assert(wordSpace !== undefined, "line has no word space");

    expect(wordSpace.widthEm).toBe(0.5);
    expect(
      firstLine.items.flatMap((item) =>
        item.kind === "glue" && item.origin === "generated" && item.adjustment === "stretched"
          ? [item.widthEm]
          : [],
      ),
      // 仮名同士の4か所は八分の途中で止まり、和欧混植の四分2か所は、
      // JLReq 3.8.4 b が上限とする二分まで使い切る。
    ).toEqual([
      expect.closeTo(0.125, 10),
      expect.closeTo(0.125, 10),
      expect.closeTo(0.125, 10),
      expect.closeTo(0.125, 10),
      0.5,
      0.5,
    ]);
  });

  test("keeps a line-end half em whole and squeezes the comma instead", () => {
    // 字詰め10字の行に10字と四分。JLReq 3.1.9 は行末の句点の後ろを二分アキかベタ組のどちらかとし、
    // その中間を認めないので、この行がはみ出す四分をそこから詰めることはできない。
    // 代わりに、JLReq が連続的に詰めることを認める読点の二分から詰める。
    //
    // "ab" は横倒しの欧文の単語（cl-27、1字二分で2字）だ。これは、
    // 3.2.4 によって正立の欧字が cl-19 に移る前に、
    // 正立の欧字1字が持っていた全角の幅と和欧混植の四分に合わせたものだ。
    const result = composeManuscript(parsed("ああああab、あああ。"), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const lines = contentLines(result.value);
    expect(lines.map(lineText)).toEqual(["ああああab、あああ。"]);
    const line = lines[0];
    expect.assert(line !== undefined, "layout has no content line");

    expect(line.break).toEqual({ kind: "shrunk" });
    expect(
      line.items.flatMap((item) =>
        item.kind === "glue" && item.naturalWidthEm === 0.5
          ? [{ widthEm: item.widthEm, adjustment: item.adjustment }]
          : [],
      ),
    ).toEqual([
      { widthEm: 0.25, adjustment: "shrunk" },
      { widthEm: 0.5, adjustment: "natural" },
    ]);
    expect(line.inlineSizeEm).toBe(10);
  });

  test("takes the quarter em before and after a line-end middle dot together or not at all", () => {
    // 同じ行で、行末を中点にしたもの。表3 注5 は中点の前の四分と後ろの四分を一つの量として扱い、
    // その二分はこの行のはみ出し量より大きいので、どちらも動かず、ここでも読点が詰める。
    // 後ろの四分だけを詰めると、中点が片寄ってしまう。
    const result = composeManuscript(parsed("ああああab、あああ・"), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const line = contentLines(result.value)[0];
    expect.assert(line !== undefined, "layout has no content line");

    expect(line.break).toEqual({ kind: "shrunk" });
    expect(
      line.items.flatMap((item) =>
        item.kind === "glue" && item.naturalWidthEm > 0 ? [item.widthEm] : [],
      ),
      // 欧字との間の四分、四分まで詰めた読点の二分、そのまま残る中点の二つの四分。
    ).toEqual([0.25, 0.25, 0.25, 0.25]);
  });

  test("spreads a shortfall evenly over the pairs of one stage", () => {
    // 上と同じ段落。仮名同士の6か所はそれぞれ四分まで空けられ、行は全角1字分足りない。
    // そのため JLReq 3.8.4 c は、最初の4か所に四分ずつ入れるのではなく、
    // 6か所すべてに全角の6分の1ずつを入れる。
    const result = composeManuscript(parsed("「あああああああ、……"), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const firstLine = contentLines(result.value)[0];
    expect.assert(firstLine !== undefined, "layout has no first content line");

    const stretched = firstLine.items.flatMap((item) =>
      item.kind === "glue" && item.adjustment === "stretched" ? [item.widthEm] : [],
    );

    expect(stretched).toHaveLength(6);
    for (const widthEm of stretched) expect(widthEm).toBeCloseTo(1 / 6, 10);
  });

  test("breaks a line rather than squeezing a full stop or a line-head bracket", () => {
    // JLReq 3.8.3 は行中の句点の後ろの二分を行の調整処理の対象から外し、
    // 表3 は行頭をそもそも対象から外す。#94 で行頭の括弧が版面の端に密着したのは、
    // この二つを詰めたためだ。そのため、この段落は詰めずに分割しなければならない。
    const result = composeManuscript(parsed("「あ。あああああああ、"), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const lines = contentLines(result.value);
    expect(lines.length).toBeGreaterThan(1);
    const firstLine = lines[0];
    expect.assert(firstLine !== undefined, "layout has no first content line");
    expect(
      firstLine.items.flatMap((item) => (item.kind === "glue" ? [item.adjustment] : [])),
    ).not.toContain("shrunk");
    const openingBracket = lineGlyphs(firstLine)[0];
    expect.assert(openingBracket !== undefined, "layout has no opening bracket");
    expect(openingBracket.layoutSpan.offsetEm).toBe(0.5);
  });

  test("sets an opening bracket flush against the edge on a turned-over line", () => {
    // JLReq 3.1.5 の③では、始め括弧の前を改行行頭では二分アキ、折返し行頭ではアキなしとする。
    // ここで許される分割位置は括弧の前だけなので、2行目は折返し行になる。
    const result = composeManuscript(parsed(`${"あ".repeat(9)}「ああ`), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const lines = contentLines(result.value);
    expect(lines.map(lineText)).toEqual(["あああああああああ", "「ああ"]);

    const turnedOver = lines[1];
    expect.assert(turnedOver !== undefined, "layout has no turned-over line");
    const openingBracket = lineGlyphs(turnedOver)[0];
    expect.assert(openingBracket !== undefined, "turned-over line has no opening bracket");

    expect(openingBracket.layoutSpan.offsetEm).toBe(0);
    // 同じ行が段落の先頭にある場合より二分狭い。
    expect(turnedOver.inlineSizeEm).toBe(2.5);
  });

  test.each([
    ["あ。い", 3],
    ["あ。」い", 3.5],
    ["あ」。い", 3.5],
    ["あ、」い", 3.5],
    ["「『あ", 2.5],
    ["あ・い", 3],
    // 正立の欧字または数字1字は cl-19 に分類され（3.2.4）、
    // ほかの漢字等と同じく仮名とはベタ組になる。
    ["あAい", 3],
    ["あ1い", 3],
    // 横倒しの欧文の単語（cl-27）は、3.2.6 の四分を両側に保つ。
    // "abc" は正立にする略語のパターンに当たらないので、1字二分で横倒しに表示する。
    ["あabcい", 4],
  ] as const)("sets %s in %s em, as 表1 prescribes", (source, inlineSizeEm) => {
    const result = composeManuscript(parsed(source), {
      composer: novelComposer,
      settings: settings({ lineLengthEm: 40 }),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const lines = contentLines(result.value);
    const line = lines[0];
    expect.assert(line !== undefined, "layout has no content line");

    expect(lines.map(lineText)).toEqual([source]);
    expect(line.inlineSizeEm).toBe(inlineSizeEm);
  });

  test("sets an upright western run solid against surrounding kana, as JLReq 3.2.4 prescribes", () => {
    // "QR" は大文字2字の略語なので、コンポーザーは横倒しではなく正立で組む。
    // JLReq 3.2.4 は正立の欧字を横向きの欧文のラン（cl-27）ではなく漢字（cl-19）と同じクラスに
    // 分類するので、3.2.6 の四分はここには適用しない。
    const result = composeManuscript(parsed("あQRい"), {
      composer: novelComposer,
      settings: settings({ lineLengthEm: 40 }),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const line = contentLines(result.value)[0];
    expect.assert(line !== undefined, "layout has no content line");

    expect(line.inlineSizeEm).toBe(4);
    expect(line.items.flatMap((item) => (item.kind === "glue" ? [item.widthEm] : []))).toEqual([
      0, 0,
    ]);
  });

  test("sets a middle dot on a half em with a quarter on each side", () => {
    const result = composeManuscript(parsed("あ・い"), {
      composer: novelComposer,
      settings: settings({ lineLengthEm: 40 }),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const line = contentLines(result.value)[0];
    expect.assert(line !== undefined, "layout has no content line");
    const middleDot = lineGlyphs(line).find(({ value }) => value === "・");
    expect.assert(middleDot !== undefined, "layout has no middle dot");
    expect(middleDot.layoutSpan).toEqual({ offsetEm: 1.25, advanceEm: 0.5 });
    // 字面は全角の幅のまま、新しい送り幅である二分のボックスの中央に置く。
    expect(middleDot.renderSpan).toEqual({ offsetEm: 1, advanceEm: 1 });
    expect(
      line.items.flatMap((item) =>
        item.kind === "glue" && item.naturalWidthEm > 0 ? [item.widthEm] : [],
      ),
    ).toEqual([0.25, 0.25]);
  });

  test("keeps shared opening and closing brackets away from illegal line boundaries", () => {
    const source = `${"あ".repeat(9)}(続\n${"あ".repeat(10)})`;
    const result = composeManuscript(parsed(source), {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    expect(contentLines(result.value).map(lineText)).toEqual([
      "あ".repeat(9),
      "(続",
      "あ".repeat(9),
      "あ)",
    ]);
  });

  test("moves a fittable group ruby as one unit", () => {
    const source = `${"あ".repeat(9)}｜漢字《かんじ》`;
    const parseResult = parseManuscript(source, { parser: kakuyomuParser });
    expect.assert(parseResult.ok, "fixture did not parse");

    const result = composeManuscript(parseResult.value, {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    expect(contentLines(result.value).map(lineText)).toEqual(["あ".repeat(9), "漢字"]);
  });

  test("centres a base character inside the box a longer group reading widens", () => {
    const parseResult = parseManuscript("｜夢《にやりたいこと》", { parser: kakuyomuParser });
    expect.assert(parseResult.ok, "fixture did not parse");

    const result = composeManuscript(parseResult.value, {
      composer: novelComposer,
      settings: settings({ lineLengthEm: 20 }),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const line = contentLines(result.value)[0];
    expect.assert(line !== undefined, "layout has no content line");
    const base = lineGlyphs(line)[0];
    const ruby = line.annotations.find((annotation) => annotation.kind === "ruby");
    expect.assert(base !== undefined, "line has no base glyph");
    expect.assert(ruby !== undefined, "line has no ruby fragment");

    // 7書記素のルビ文字は、全角1字の親文字に対して3字半の長さになる。
    // そのため親文字のボックスをルビ文字の長さまで広げ、
    // 余りは親文字の後ろではなく両側に振り分ける。
    expect(base.layoutSpan.advanceEm).toBe(3.5);
    expect(base.renderSpan.offsetEm - base.layoutSpan.offsetEm).toBeCloseTo(
      base.layoutSpan.offsetEm +
        base.layoutSpan.advanceEm -
        (base.renderSpan.offsetEm + base.renderSpan.advanceEm),
      10,
    );
  });

  test("spends a longer group reading on the base gaps in JLReq's one to two ratio", () => {
    const parseResult = parseManuscript("｜漢字《ながいよみです》", { parser: kakuyomuParser });
    expect.assert(parseResult.ok, "fixture did not parse");

    const result = composeManuscript(parseResult.value, {
      composer: novelComposer,
      settings: settings({ lineLengthEm: 20 }),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const line = contentLines(result.value)[0];
    expect.assert(line !== undefined, "layout has no content line");
    const [first, second] = lineGlyphs(line);
    const ruby = line.annotations.find((annotation) => annotation.kind === "ruby");
    expect.assert(first !== undefined && second !== undefined, "line has no base characters");
    expect.assert(ruby !== undefined, "line has no ruby fragment");

    const leading = first.renderSpan.offsetEm - first.layoutSpan.offsetEm;
    const between =
      second.renderSpan.offsetEm - (first.renderSpan.offsetEm + first.renderSpan.advanceEm);
    const trailing =
      second.layoutSpan.offsetEm +
      second.layoutSpan.advanceEm -
      (second.renderSpan.offsetEm + second.renderSpan.advanceEm);

    expect(leading).toBeGreaterThan(0);
    expect(between).toBeCloseTo(leading * 2, 10);
    expect(trailing).toBeCloseTo(leading, 10);
  });

  test("centres a base character inside the box a longer mono reading widens", () => {
    const base = parseManuscript("漢字");
    expect.assert(base.ok, "fixture did not parse");
    const range = ManuscriptRange.merge(base.value.graphemes.map(({ range: own }) => own));
    expect.assert(range !== null, "fixture did not contain a ruby base range");
    const monoRubyParser: ManuscriptParser = {
      id: "example/mono-ruby",
      parse: () =>
        ManuscriptResult.succeed<ParsedManuscript>({
          ...base.value,
          annotations: [
            { kind: "ruby", range, reading: { kind: "mono", segments: ["かん", "むずかし"] } },
          ],
        }),
    };
    const parseResult = parseManuscript("漢字", { parser: monoRubyParser });
    expect.assert(parseResult.ok, "fixture did not parse");

    const result = composeManuscript(parseResult.value, {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const line = contentLines(result.value)[0];
    expect.assert(line !== undefined, "layout has no content line");
    const [unwidened, widened] = lineGlyphs(line);
    expect.assert(unwidened !== undefined && widened !== undefined, "line has no base characters");

    // 2書記素のルビ文字は親文字にちょうど収まる。4書記素のルビ文字は全角2字分を必要とし、
    // JLReq 3.3.5 はそのルビを、親文字をボックスの先頭に寄せるのではなく中付きにする。
    expect(unwidened.renderSpan.offsetEm).toBe(unwidened.layoutSpan.offsetEm);
    expect(widened.layoutSpan.advanceEm).toBe(2);
    expect(widened.renderSpan.offsetEm - widened.layoutSpan.offsetEm).toBeCloseTo(0.5, 10);
  });

  test("splits an oversized group ruby without repeating or dropping its reading", () => {
    const base = "漢".repeat(20);
    const reading = "あ".repeat(50);
    const parseResult = parseManuscript(`｜${base}《${reading}》`, { parser: kakuyomuParser });
    expect.assert(parseResult.ok, "fixture did not parse");

    const result = composeManuscript(parseResult.value, {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const rubyFragments = contentLines(result.value).flatMap(({ annotations }) =>
      annotations.filter((annotation) => annotation.kind === "ruby"),
    );
    expect(rubyFragments.map((fragment) => fragment.reading).join("")).toBe(reading);
    expect(rubyFragments).toHaveLength(3);
  });

  test("reserves reading text for every group ruby fragment when enough text exists", () => {
    const base = "漢".repeat(12);
    const reading = "よみ";
    const parseResult = parseManuscript(`｜${base}《${reading}》`, { parser: kakuyomuParser });
    expect.assert(parseResult.ok, "fixture did not parse");

    const result = composeManuscript(parseResult.value, {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const rubyFragments = contentLines(result.value).flatMap(({ annotations }) =>
      annotations.filter((annotation) => annotation.kind === "ruby"),
    );
    expect(rubyFragments.map(({ reading: fragmentReading }) => fragmentReading)).toEqual([
      "よ",
      "み",
    ]);
  });

  test("keeps suppressed base graphemes in group ruby fragment boundaries", () => {
    const reading = "よみよみよ";
    const parseResult = parseManuscript(`[[rb:あいうえおかきくけ！　こ>${reading}]]`, {
      parser: pixivParser,
    });
    expect.assert(parseResult.ok, "fixture did not parse");

    const result = composeManuscript(parseResult.value, {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const lines = contentLines(result.value);
    const rubyFragments = lines.flatMap(({ annotations }) =>
      annotations.filter((annotation) => annotation.kind === "ruby"),
    );
    expect(lines.flatMap((line) => suppressedItems(line).map(({ value }) => value))).toEqual([
      "　",
    ]);
    const [firstFragment, secondFragment] = rubyFragments;
    expect.assert(firstFragment !== undefined && secondFragment !== undefined);
    expect(firstFragment.fragmentRange.graphemes.end).toBe(
      secondFragment.fragmentRange.graphemes.start,
    );
    expect(rubyFragments.map(({ reading: fragmentReading }) => fragmentReading)).toEqual([
      "よみよみ",
      "よ",
    ]);
    expect(rubyFragments.map(({ reading: fragmentReading }) => fragmentReading).join("")).toBe(
      reading,
    );
  });

  test("preserves a group reading when there are more fragments than reading graphemes", () => {
    const base = "漢".repeat(12);
    const reading = "よ";
    const parseResult = parseManuscript(`｜${base}《${reading}》`, { parser: kakuyomuParser });
    expect.assert(parseResult.ok, "fixture did not parse");

    const result = composeManuscript(parseResult.value, {
      composer: novelComposer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const rubyFragments = contentLines(result.value).flatMap(({ annotations }) =>
      annotations.filter((annotation) => annotation.kind === "ruby"),
    );
    expect(rubyFragments).toHaveLength(2);
    expect(rubyFragments.map(({ reading: fragmentReading }) => fragmentReading).join("")).toBe(
      reading,
    );
  });

  test("splits an oversized group reading in proportion to measured base advances", () => {
    // 横倒しのランと漢字は、一つのグループルビのまとまりを共有する。
    const base = `ab${"漢".repeat(10)}`;
    const reading = "あ".repeat(9);
    const parseResult = parseManuscript(`｜${base}《${reading}》`, { parser: kakuyomuParser });
    expect.assert(parseResult.ok, "fixture did not parse");
    const composer = createNovelComposer({
      measurer: ({ text, kind }) => {
        if (kind === "ruby") return { kind: "advance", advanceEm: text.length / 10 };
        return { kind: "advance", advanceEm: text === "a" || text === "b" ? 4.5 : 1 };
      },
    });

    const result = composeManuscript(parseResult.value, {
      composer,
      settings: settings(),
    });

    expect.assert(result.ok, "expected composition to succeed");
    const rubyFragments = contentLines(result.value).flatMap(({ annotations }) =>
      annotations.filter((annotation) => annotation.kind === "ruby"),
    );
    // B.2 注10 は、グループ内では通常の和欧混植のアキを除外する。
    // 欧文9字分と漢字1字が1行目に収まり、ルビ文字は round(9 * 10 / 19) = 5 字になる。
    expect(contentLines(result.value).map(lineText)).toEqual([`ab漢`, "漢".repeat(9)]);
    expect(rubyFragments.map(({ reading }) => reading)).toEqual(["あ".repeat(5), "あ".repeat(4)]);
  });

  test("rejects an invalid custom measurement as a typed composer rejection", () => {
    const result = composeManuscript(parsed("本文"), {
      composer: createNovelComposer({
        measurer: () => ({ kind: "advance", advanceEm: Number.NaN }),
      }),
      settings: settings(),
    });

    expect.assert(result.ok === false, "expected composition to fail");
    expect(result.error).toMatchObject({ kind: "ComposerRejected", composerId: "kg/novel" });
  });

  test("rejects an invalid per-grapheme ruby measurement", () => {
    const parseResult = parseManuscript("｜漢字《かんじ》", { parser: kakuyomuParser });
    expect.assert(parseResult.ok, "fixture did not parse");
    const composer = createNovelComposer({
      measurer: ({ text, kind }) => ({
        kind: "advance",
        advanceEm: kind === "ruby" && text === "か" ? Number.NaN : 1,
      }),
    });

    const result = composeManuscript(parseResult.value, {
      composer,
      settings: settings(),
    });

    expect.assert(result.ok === false, "expected composition to fail");
    expect(result.error).toMatchObject({ kind: "ComposerRejected", composerId: "kg/novel" });
  });

  test("returns a composition failure when offsets leave no usable lines", () => {
    const invalid: NovelCompositionSettings = {
      ...settings(),
      offsets: {
        ...NovelCompositionSettings.defaults.offsets,
        stage: { leading: 5, trailing: 5 },
      },
    };

    const result = composeManuscript(parsed("本文"), {
      composer: novelComposer,
      settings: invalid,
    });

    expect.assert(result.ok === false, "expected composition to fail");
    expect(result.error).toMatchObject({ kind: "InvalidSettings", composerId: "kg/novel" });
  });

  test("uses a custom composer supplied through the options object", () => {
    const result = composeManuscript(parsed("本文"), {
      composer: labelComposer("example/count", (prefix, displayText) => ({
        label: prefix + displayText,
      })),
      settings: { prefix: ">" },
    });

    expect(result).toMatchObject({
      ok: true,
      value: { composerId: "example/count", layout: { label: ">本文" } },
    });
  });

  test("rejects custom composer output that does not match its layout schema", () => {
    const result = composeManuscript(parsed("本文"), {
      composer: labelComposer("example/broken", lyingLabel),
      settings: { prefix: ">" },
    });

    expect.assert(result.ok === false, "expected composition to fail");
    expect(result.error).toMatchObject({
      kind: "InvalidComposerOutput",
      composerId: "example/broken",
    });
  });

  test("reports a composer ID that is not namespaced", () => {
    const result = composeManuscript(parsed("本文"), {
      composer: labelComposer("broken", (prefix) => ({ label: prefix })),
      settings: { prefix: ">" },
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: "InvalidComposerId", composerId: "broken" },
    });
  });
});
