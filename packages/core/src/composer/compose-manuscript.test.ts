import * as v from "valibot";
import { describe, expect, test } from "vite-plus/test";

import { kakuyomuParser } from "../parser/kakuyomu-parser";
import { parseManuscript } from "../parser/parse-manuscript";
import { pixivParser } from "../parser/pixiv-parser";
import { ManuscriptResult } from "../result/manuscript-result";
import { composeManuscript } from "./compose-manuscript";
import { NovelCompositionSettings } from "./composition-settings";
import type { ManuscriptComposer } from "./manuscript-composer";
import type { NovelComposedManuscript } from "./novel-composer";
import { createNovelComposer, novelComposer } from "./novel-composer";
import type { NovelLine } from "./novel-line";

function lineGlyphs(line: NovelLine) {
  return line.items.filter((item) => item.kind === "glyph");
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
  return {
    ...NovelCompositionSettings.defaults,
    flow: {
      lineLengthEm: 10,
      linesPerStage: 10,
      stagesPerPage: 1,
      ...patch,
    },
  };
}

function lineText(line: NovelLine): string {
  return line.items
    .flatMap((item) =>
      item.kind === "glyph" || (item.kind === "glue" && item.origin === "source")
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
        presentation: presentation.kind,
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
      { value: "1", advanceEm: 0.5, presentation: "tate-chu-yoko" },
      { value: "2", advanceEm: 0.5, presentation: "tate-chu-yoko" },
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
    // Ten and a half em of text in a ten em line, with a half em to give at the mid-line comma and
    // another at the line end.
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
      // The half em after the comma keeps its width; the invisible one at the line end goes instead.
      { widthEm: 0.5, adjustment: "natural" },
      { widthEm: 0, adjustment: "shrunk" },
    ]);
    expect(line.inlineSizeEm).toBe(10);
  });

  test("breaks a line rather than squeezing a full stop or a line-head bracket", () => {
    // JLReq 3.8.3 keeps the half em after a mid-line full stop out of line adjustment, and 表3
    // excludes the line head from it altogether. Shrinking those two is what pulled a line-head
    // bracket flush against the edge in #94, so this paragraph has to break instead.
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

  test.each([
    ["あ。い", 3],
    ["あ。」い", 3.5],
    ["あ」。い", 3.5],
    ["あ、」い", 3.5],
    ["「『あ", 2.5],
    ["あ・い", 3],
    ["あAい", 3.5],
    ["あ1い", 3.5],
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
    // The ink stays a full em wide and is centred on the half-em box it now advances by.
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
    const base = `A${"漢".repeat(10)}`;
    const reading = "あ".repeat(9);
    const parseResult = parseManuscript(`｜${base}《${reading}》`, { parser: kakuyomuParser });
    expect.assert(parseResult.ok, "fixture did not parse");
    const composer = createNovelComposer({
      measurer: ({ text, role }) => {
        if (role === "ruby") return { advanceEm: text.length / 10 };
        return { advanceEm: text === "A" ? 9 : 1 };
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
    // The Latin base measures nine em against ten kanji of one em, and the quarter em JLReq 3.2.6
    // puts between them leaves the first line to the Latin base alone.
    expect(rubyFragments.map(({ reading }) => reading)).toEqual(["あ".repeat(4), "あ".repeat(5)]);
  });

  test("rejects an invalid custom measurement as a typed composer rejection", () => {
    const result = composeManuscript(parsed("本文"), {
      composer: createNovelComposer({ measurer: () => ({ advanceEm: Number.NaN }) }),
      settings: settings(),
    });

    expect.assert(result.ok === false, "expected composition to fail");
    expect(result.error).toMatchObject({ kind: "ComposerRejected", composerId: "kg/novel" });
  });

  test("rejects an invalid per-grapheme ruby measurement", () => {
    const parseResult = parseManuscript("｜漢字《かんじ》", { parser: kakuyomuParser });
    expect.assert(parseResult.ok, "fixture did not parse");
    const composer = createNovelComposer({
      measurer: ({ text, role }) => ({
        advanceEm: role === "ruby" && text === "か" ? Number.NaN : 1,
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
