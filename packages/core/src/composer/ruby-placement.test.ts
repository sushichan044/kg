import { describe, expect, test } from "vite-plus/test";

import type { RubyReading } from "../parser/annotation/ruby-annotation";
import { parseManuscript } from "../parser/parse-manuscript";
import { ManuscriptRange } from "../range/manuscript-range";
import { composeManuscript } from "./compose-manuscript";
import { NovelCompositionSettings } from "./composition-settings";
import { MeasurementTextRange } from "./measurement-text-range";
import { createNovelComposer, novelComposer } from "./novel-composer";
import { PositionedInlineItem } from "./positioned-inline-item";
import { logicalRunMeasurer } from "./run-measurer";

function composeRuby(
  text: string,
  readings: ReadonlyArray<Readonly<{ start: number; length: number; reading: RubyReading }>>,
  composer = novelComposer,
) {
  const parsed = parseManuscript(text);
  expect.assert(parsed.ok);
  const annotations = readings.map(({ start, length, reading }) => {
    const range = ManuscriptRange.merge(
      parsed.value.graphemes.slice(start, start + length).map((grapheme) => grapheme.range),
    );
    expect.assert(range !== null);
    return { kind: "ruby", range, reading } as const;
  });

  const composed = composeManuscript(
    { ...parsed.value, annotations },
    {
      composer,
      settings: {
        ...NovelCompositionSettings.defaults,
        flow: { ...NovelCompositionSettings.defaults.flow, lineLengthEm: 10 },
      },
    },
  );

  expect.assert(composed.ok);
  const lines = composed.value.layout.pages.flatMap((page) =>
    page.stages.flatMap((stage) => stage.lines.filter((line) => line.range !== null)),
  );
  const glyphs = lines.flatMap((line) => line.items.filter(PositionedInlineItem.isRenderUnit));
  const ruby = lines.flatMap((line) => line.annotations.filter((item) => item.kind === "ruby"));
  return { lines, glyphs, ruby };
}

describe("contextual ruby placement", () => {
  test("uses the ruby complex class at the paragraph head without changing the bracket box", () => {
    const { lines, glyphs } = composeRuby("「あ", [
      { start: 0, length: 1, reading: { kind: "mono", segments: ["か"] } },
    ]);
    const bracket = glyphs[0];
    const line = lines[0];
    expect.assert(bracket !== undefined && line !== undefined);

    expect(bracket.layoutSpan).toEqual({ offsetEm: 0, advanceEm: 0.5 });
    expect(line.inlineSizeEm).toBe(1.5);
  });

  test("omits ordinary punctuation tail spacing on an annotated full stop", () => {
    const { lines } = composeRuby("漢。", [
      { start: 1, length: 1, reading: { kind: "mono", segments: ["てん"] } },
    ]);
    const line = lines[0];
    expect.assert(line !== undefined);

    expect(line.inlineSizeEm).toBe(2);
  });

  test("allows separate mono complexes on identical marks to split between their readings", () => {
    const { lines } = composeRuby(`${"あ".repeat(9)}……${"あ".repeat(9)}`, [
      { start: 9, length: 2, reading: { kind: "mono", segments: ["てん", "てん"] } },
    ]);

    expect(lines).toHaveLength(2);
    expect(
      lines.map((line) => {
        expect.assert(line.range !== null);
        return line.range.graphemes.end;
      }),
    ).toEqual([10, 20]);
    expect(
      lines.map((line) =>
        line.annotations.flatMap((annotation) =>
          annotation.kind === "ruby" ? [annotation.reading] : [],
        ),
      ),
    ).toEqual([["てん"], ["てん"]]);
  });

  test("widens a base when its reading cannot fit the middle-dot quarter space", () => {
    const { glyphs, ruby } = composeRuby("あ漢・あ", [
      { start: 1, length: 1, reading: { kind: "mono", segments: ["かんじよ"] } },
    ]);
    const base = glyphs[1];
    const dot = glyphs[2];
    const last = ruby[0]?.readingItems.at(-1);
    expect.assert(base !== undefined && dot !== undefined && last !== undefined);

    expect(base.layoutSpan).toEqual({ offsetEm: 1, advanceEm: 1.25 });
    expect(dot.layoutSpan.offsetEm).toBe(2.5);
    expect(last.placement.inlineSpan.offsetEm + last.placement.inlineSpan.advanceEm).toBe(2.5);
  });

  test("lets a reading use authored paragraph indentation and the following ideographic space", () => {
    const { glyphs, ruby } = composeRuby("　漢　", [
      { start: 1, length: 1, reading: { kind: "mono", segments: ["かんじよ"] } },
    ]);
    const base = glyphs[1];
    const first = ruby[0]?.readingItems[0];
    const last = ruby[0]?.readingItems.at(-1);
    expect.assert(base !== undefined && first !== undefined && last !== undefined);

    expect(base.layoutSpan).toEqual({ offsetEm: 1, advanceEm: 1 });
    expect(first.placement.inlineSpan.offsetEm).toBe(0.5);
    expect(last.placement.inlineSpan.offsetEm + last.placement.inlineSpan.advanceEm).toBe(2.5);
  });

  test("uses the ruby complex class for an annotated mark beside a Western run", () => {
    const { glyphs } = composeRuby("…abcd", [
      { start: 0, length: 1, reading: { kind: "mono", segments: ["てん"] } },
    ]);
    const western = glyphs[1];
    expect.assert(western !== undefined);

    expect(western.layoutSpan.offsetEm).toBe(1.25);
  });

  test("lets a long mono reading overhang adjacent kana without widening its base", () => {
    const { glyphs, ruby } = composeRuby("あ漢あ", [
      { start: 1, length: 1, reading: { kind: "mono", segments: ["かんじよ"] } },
    ]);
    const base = glyphs[1];
    const first = ruby[0]?.readingItems[0];
    const last = ruby[0]?.readingItems.at(-1);
    expect.assert(base !== undefined && first !== undefined && last !== undefined);

    expect(base.layoutSpan).toEqual({ offsetEm: 1, advanceEm: 1 });
    expect(first.placement.inlineSpan.offsetEm).toBe(0.5);
    expect(last.placement.inlineSpan.offsetEm + last.placement.inlineSpan.advanceEm).toBe(2.5);
  });

  test("widens a mono base instead of letting its reading overhang adjacent kanji", () => {
    const { glyphs, ruby } = composeRuby("字漢字", [
      { start: 1, length: 1, reading: { kind: "mono", segments: ["かんじよ"] } },
    ]);
    const base = glyphs[1];
    const first = ruby[0]?.readingItems[0];
    expect.assert(base !== undefined && first !== undefined);

    expect(base.layoutSpan.advanceEm).toBe(2);
    expect(first.placement.inlineSpan.offsetEm).toBe(1);
    expect(base.renderSpan.offsetEm).toBe(1.5);
  });

  test.each(["漢あ", "あ漢"])("keeps a long reading inside the line edge in %s", (text) => {
    const { lines, glyphs, ruby } = composeRuby(text, [
      { start: text.indexOf("漢"), length: 1, reading: { kind: "mono", segments: ["かんじよ"] } },
    ]);
    const line = lines[0];
    const base = glyphs.find((glyph) => glyph.value === "漢");
    const first = ruby[0]?.readingItems[0];
    const last = ruby[0]?.readingItems.at(-1);
    expect.assert(
      line !== undefined && base !== undefined && first !== undefined && last !== undefined,
    );

    expect(base.layoutSpan.advanceEm).toBe(1.5);
    expect(first.placement.inlineSpan.offsetEm).toBeGreaterThanOrEqual(0);
    expect(
      last.placement.inlineSpan.offsetEm + last.placement.inlineSpan.advanceEm,
    ).toBeLessThanOrEqual(line.inlineSizeEm);
  });

  test("anchors each mono reading to its own base", () => {
    const { ruby } = composeRuby("漢字", [
      { start: 0, length: 2, reading: { kind: "mono", segments: ["か", "むずかし"] } },
    ]);
    const first = ruby[0]?.readingItems[0];
    const second = ruby[0]?.readingItems[1];
    expect.assert(first !== undefined && second !== undefined);

    expect(first.placement.inlineSpan.offsetEm).toBe(0.25);
    expect(second.placement.inlineSpan.offsetEm).toBe(1);
  });

  test("separates readings that overhang the same intervening kana by one ruby em", () => {
    const { lines, ruby } = composeRuby("あ漢あ字あ", [
      { start: 1, length: 1, reading: { kind: "mono", segments: ["かんじよ"] } },
      { start: 3, length: 1, reading: { kind: "mono", segments: ["じのよみ"] } },
    ]);
    const left = ruby[0]?.readingItems.at(-1);
    const right = ruby[1]?.readingItems[0];
    const line = lines[0];
    expect.assert(left !== undefined && right !== undefined && line !== undefined);

    expect(
      right.placement.inlineSpan.offsetEm -
        (left.placement.inlineSpan.offsetEm + left.placement.inlineSpan.advanceEm),
    ).toBeCloseTo(0.5, 10);
    expect(line.inlineSizeEm).toBe(5.5);
  });

  test("lets a fittable group overhang kana while retaining the whole association", () => {
    const { glyphs, ruby } = composeRuby("あ漢字あ", [
      { start: 1, length: 2, reading: { kind: "group", text: "かんじのよみ" } },
    ]);
    const first = ruby[0]?.readingItems[0];
    const last = ruby[0]?.readingItems.at(-1);
    expect.assert(first !== undefined && last !== undefined);

    expect(glyphs.map((glyph) => glyph.layoutSpan.advanceEm)).toEqual([1, 1, 1, 1]);
    expect(first.placement.inlineSpan.offsetEm).toBe(0.5);
    expect(last.placement.inlineSpan.offsetEm + last.placement.inlineSpan.advanceEm).toBe(3.5);
    expect(ruby).toHaveLength(1);
    expect(ruby[0]?.fragmentRange.graphemes).toEqual({ start: 1, end: 3 });
  });

  test("uses the punctuation space before a ruby instead of widening its base", () => {
    const { glyphs, ruby } = composeRuby("）漢あ", [
      { start: 1, length: 1, reading: { kind: "mono", segments: ["かんじよ"] } },
    ]);
    const base = glyphs[1];
    const reading = ruby[0]?.readingItems[0];
    expect.assert(base !== undefined && reading !== undefined);

    expect(base.layoutSpan).toEqual({ offsetEm: 1, advanceEm: 1 });
    expect(reading.placement.inlineSpan.offsetEm).toBe(0.5);
  });
});

describe("candidate-local group reading allocation", () => {
  test(
    "conserves a long group reading within a bounded composition time",
    { timeout: 15000 },
    () => {
      const text = "漢".repeat(2000);
      const reading = "あ".repeat(5000);
      const started = Date.now();

      const { lines, ruby } = composeRuby(text, [
        { start: 0, length: text.length, reading: { kind: "group", text: reading } },
      ]);

      expect(ruby.map((fragment) => fragment.reading).join("")).toBe(reading);
      expect(lines).toHaveLength(250);
      expect(Date.now() - started).toBeLessThan(5000);
    },
  );
  test("splits reading only between provider clusters while conserving its text", () => {
    const composer = createNovelComposer({
      measurer: (request) =>
        request.kind === "ruby" && request.text === "abcdef"
          ? {
              kind: "clustered",
              advanceEm: 3,
              clusters: [
                {
                  textRange: MeasurementTextRange.of({ start: 0, end: 3 }),
                  layoutSpan: { offsetEm: 0, advanceEm: 1.5 },
                  renderSpan: { offsetEm: 0, advanceEm: 1.5 },
                },
                {
                  textRange: MeasurementTextRange.of({ start: 3, end: 6 }),
                  layoutSpan: { offsetEm: 1.5, advanceEm: 1.5 },
                  renderSpan: { offsetEm: 1.5, advanceEm: 1.5 },
                },
              ],
            }
          : logicalRunMeasurer(request),
    });

    const { ruby } = composeRuby(
      "漢".repeat(12),
      [{ start: 0, length: 12, reading: { kind: "group", text: "abcdef" } }],
      composer,
    );

    expect(ruby.map((fragment) => fragment.reading)).toEqual(["abc", "def"]);
    expect(ruby.flatMap((fragment) => fragment.readingItems.map((item) => item.value))).toEqual([
      "abc",
      "def",
    ]);
  });

  test("consumes an indivisible reading cluster once even when the base spans two lines", () => {
    const composer = createNovelComposer({
      measurer: (request) =>
        request.kind === "ruby" && request.text === "abcdef"
          ? {
              kind: "clustered",
              advanceEm: 3,
              clusters: [
                {
                  textRange: MeasurementTextRange.of({ start: 0, end: 6 }),
                  layoutSpan: { offsetEm: 0, advanceEm: 3 },
                  renderSpan: { offsetEm: 0, advanceEm: 3 },
                },
              ],
            }
          : logicalRunMeasurer(request),
    });

    const { ruby } = composeRuby(
      "漢".repeat(12),
      [{ start: 0, length: 12, reading: { kind: "group", text: "abcdef" } }],
      composer,
    );

    expect(ruby).toHaveLength(2);
    expect(ruby.map((fragment) => fragment.reading).join("")).toBe("abcdef");
    expect(ruby.flatMap((fragment) => fragment.readingItems)).toHaveLength(1);
  });
});

describe("joint jukugo placement", () => {
  test.each([
    ["京都", ["きょう", "と"], [0, 1.5]],
    ["字熟", ["じ", "じゅく"], [0, 0.5]],
    ["温泉", ["おん", "せん"], [0, 1]],
    ["漢字語", ["かんじ", "じご", "ご"], [0, 1.5, 2.5]],
  ] as const)("jointly arranges %s without expanding its bases", (text, segments, offsets) => {
    const { glyphs, ruby } = composeRuby(text, [
      { start: 0, length: text.length, reading: { kind: "jukugo", segments } },
    ]);
    const fragment = ruby[0];
    expect.assert(fragment !== undefined);
    const starts: number[] = [];
    let itemIndex = 0;
    for (const segment of segments) {
      const first = fragment.readingItems[itemIndex];
      expect.assert(first !== undefined);
      starts.push(first.placement.inlineSpan.offsetEm);
      itemIndex += segment.length;
    }

    expect(glyphs.map((glyph) => glyph.layoutSpan.advanceEm)).toEqual(
      Array.from({ length: text.length }, () => 1),
    );
    expect(starts).toEqual(offsets);
    expect(fragment.reading).toBe(segments.join(""));
    expect(fragment.rubyKind).toBe("jukugo");
  });

  test("uses succeeding outer kana before increasing the compound width", () => {
    const { glyphs, ruby } = composeRuby("漢字あ", [
      { start: 0, length: 2, reading: { kind: "jukugo", segments: ["かんじ", "じご"] } },
    ]);
    const last = ruby[0]?.readingItems.at(-1);
    expect.assert(last !== undefined);

    expect(glyphs.map((glyph) => glyph.layoutSpan.advanceEm)).toEqual([1, 1, 1]);
    expect(last.placement.inlineSpan.offsetEm + last.placement.inlineSpan.advanceEm).toBe(2.5);
  });

  test("adds base spacing when two long compound readings cannot share the natural width", () => {
    const { lines, glyphs, ruby } = composeRuby("漢字", [
      { start: 0, length: 2, reading: { kind: "jukugo", segments: ["かんじ", "じゅく"] } },
    ]);
    const first = ruby[0]?.readingItems[0];
    const second = ruby[0]?.readingItems[3];
    expect.assert(first !== undefined && second !== undefined);

    expect(glyphs.map((glyph) => glyph.layoutSpan.advanceEm)).toEqual([1, 1]);
    expect(glyphs.map((glyph) => glyph.layoutSpan.offsetEm)).toEqual([0, 2]);
    expect(lines[0]?.inlineSizeEm).toBe(3);
    expect(first.placement.inlineSpan.offsetEm).toBe(0);
    expect(second.placement.inlineSpan.offsetEm).toBe(1.5);
  });

  test("recomputes the readings when a compound splits between bases", () => {
    const { lines, ruby } = composeRuby(`${"あ".repeat(9)}京都`, [
      { start: 9, length: 2, reading: { kind: "jukugo", segments: ["きょう", "と"] } },
    ]);

    expect(lines).toHaveLength(2);
    expect(ruby.map((fragment) => fragment.reading)).toEqual(["きょう", "と"]);
    expect(ruby.map((fragment) => fragment.continuation)).toEqual(["start", "end"]);
    expect(ruby[1]?.readingItems[0]?.placement.inlineSpan.offsetEm).toBe(0.25);
  });
});
