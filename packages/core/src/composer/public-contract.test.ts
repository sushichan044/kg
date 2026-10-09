import * as v from "valibot";
import { describe, expect, test } from "vite-plus/test";

import { kakuyomuParser } from "../parser/kakuyomu-parser";
import { parseManuscript } from "../parser/parse-manuscript";
import { composeManuscript } from "./compose-manuscript";
import { NovelCompositionSettings } from "./composition-settings";
import { NovelSourceContract } from "./internal/novel-source-contract";
import { MeasurementTextRange } from "./measurement-text-range";
import { novelComposer } from "./novel-composer";
import { createNovelComposer } from "./novel-composer";
import { NovelLine } from "./novel-line";
import type { RunMeasurer } from "./run-measurer";
import { logicalRunMeasurer } from "./run-measurer";

function compose(source: string, measurer?: RunMeasurer) {
  const parsed = parseManuscript(source, { parser: kakuyomuParser });
  expect.assert(parsed.ok, "fixture did not parse");

  const result = composeManuscript(parsed.value, {
    composer: measurer === undefined ? novelComposer : createNovelComposer({ measurer }),
    settings: NovelCompositionSettings.defaults,
  });

  expect.assert(result.ok, "fixture did not compose");
  return result.value.layout.pages.flatMap(({ stages }) =>
    stages.flatMap(({ lines }) => lines.filter(({ range }) => range !== null)),
  );
}

describe("public render units", () => {
  test("checks each ruby reading independently by annotation range", () => {
    const source = "｜あ《い》｜う《え》";
    const parsed = parseManuscript(source, { parser: kakuyomuParser });
    expect.assert(parsed.ok);
    const lines = compose(source);
    const fragments = lines.flatMap((line) => line.annotations);
    expect(fragments).toHaveLength(2);

    const changed = lines.map((line) => ({
      ...line,
      annotations: line.annotations.map((annotation) =>
        annotation.kind === "ruby" && annotation.reading === "え"
          ? { ...annotation, reading: "い" }
          : annotation,
      ),
    }));

    expect(NovelSourceContract.matches(parsed.value, lines)).toBe(true);
    expect(NovelSourceContract.matches(parsed.value, changed)).toBe(false);
  });

  test("emits one tate-chu-yoko unit with exact positions for both source digits", () => {
    const lines = compose("あ12い");

    const items = lines.flatMap((line) => line.items);

    expect(items).toContainEqual(
      expect.objectContaining({
        kind: "combined-glyph",
        value: "12",
        presentation: "tate-chu-yoko",
        layoutSpan: { offsetEm: 1, advanceEm: 1 },
        sources: [
          expect.objectContaining({ kind: "exact", layoutSpan: { offsetEm: 1, advanceEm: 0.5 } }),
          expect.objectContaining({ kind: "exact", layoutSpan: { offsetEm: 1.5, advanceEm: 0.5 } }),
        ],
      }),
    );
  });

  test("keeps a partial ruby association while anchoring it to the whole combined unit", () => {
    const lines = compose("｜1《い》2");

    const annotations = lines.flatMap((line) => line.annotations);

    expect(annotations).toContainEqual(
      expect.objectContaining({
        kind: "ruby",
        fragmentRange: expect.objectContaining({ graphemes: { start: 0, end: 1 } }),
        readingItems: [
          expect.objectContaining({
            value: "い",
            placement: expect.objectContaining({
              side: "before",
              inlineSpan: { offsetEm: 0.25, advanceEm: 0.5 },
              blockOffsetEm: -0.5,
              blockSizeEm: 0.5,
            }),
          }),
        ],
      }),
    );
  });

  test("keeps all ligature sources on one shared position without measuring its members", () => {
    const requests: string[] = [];
    const provider: RunMeasurer = (request) => {
      requests.push(request.text);
      return request.kind === "base" && request.text === "ffi"
        ? {
            kind: "clustered",
            advanceEm: 1.25,
            clusters: [
              {
                textRange: MeasurementTextRange.of({ start: 0, end: 3 }),
                layoutSpan: { offsetEm: 0, advanceEm: 1.25 },
                renderSpan: { offsetEm: -0.1, advanceEm: 1.45 },
              },
            ],
          }
        : logicalRunMeasurer(request);
    };

    const lines = compose("あffiい", provider);

    const units = lines
      .flatMap((line) => line.items)
      .filter((item) => item.kind === "combined-glyph");
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({
      value: "ffi",
      presentation: "sideways",
      layoutSpan: { offsetEm: 1.25, advanceEm: 1.25 },
      renderSpan: { offsetEm: 1.15 },
      sources: [
        {
          kind: "shared",
          ranges: [
            expect.objectContaining({ graphemes: { start: 1, end: 2 } }),
            expect.objectContaining({ graphemes: { start: 2, end: 3 } }),
            expect.objectContaining({ graphemes: { start: 3, end: 4 } }),
          ],
          layoutSpan: { offsetEm: 1.25, advanceEm: 1.25 },
        },
      ],
    });
    expect(units[0]?.renderSpan.advanceEm).toBeCloseTo(1.45, 10);
    expect(requests).not.toContain("f");
    expect(requests).not.toContain("i");
  });

  test("preserves per-digit custom widths instead of rescaling a combined unit to one em", () => {
    const lines = compose("12", (request) =>
      request.kind === "base"
        ? { kind: "advance", advanceEm: request.text === "1" ? 2 : 3 }
        : logicalRunMeasurer(request),
    );

    const unit = lines.flatMap((line) => line.items).find((item) => item.kind === "combined-glyph");

    expect(unit).toMatchObject({
      layoutSpan: { offsetEm: 0, advanceEm: 5 },
      sources: [
        expect.objectContaining({ layoutSpan: { offsetEm: 0, advanceEm: 2 } }),
        expect.objectContaining({ layoutSpan: { offsetEm: 2, advanceEm: 3 } }),
      ],
    });
  });

  test("does not distribute a nonadditive whole-run advance across glyphs", () => {
    const lines = compose("spring", (request) => ({
      kind: "advance",
      advanceEm: request.text.length > 1 ? 100 : 0.75,
    }));

    const units = lines.flatMap((line) => line.items).filter((item) => item.kind === "glyph");

    expect(units.map((unit) => unit.layoutSpan.advanceEm)).toEqual(
      Array.from({ length: 6 }, () => 0.75),
    );
    expect(lines[0]?.inlineSizeEm).toBe(4.5);
  });

  test("keeps a clustered reading authoritative through annotation placement", () => {
    const requests: string[] = [];
    const provider: RunMeasurer = (request) => {
      requests.push(`${request.kind}:${request.text}`);
      return request.kind === "ruby" && request.text === "よみ"
        ? {
            kind: "clustered",
            advanceEm: 1,
            clusters: [
              {
                textRange: MeasurementTextRange.of({ start: 0, end: 2 }),
                layoutSpan: { offsetEm: 0, advanceEm: 1 },
                renderSpan: { offsetEm: -0.1, advanceEm: 1.2 },
              },
            ],
          }
        : logicalRunMeasurer(request);
    };

    const lines = compose("｜漢《よみ》", provider);

    const ruby = lines
      .flatMap((line) => line.annotations)
      .find((annotation) => annotation.kind === "ruby");
    expect.assert(ruby !== undefined);
    expect(ruby.readingItems).toMatchObject([
      {
        value: "よみ",
        textRange: { start: 0, end: 2 },
        placement: { inlineSpan: { offsetEm: -0.1, advanceEm: 1.2 } },
      },
    ]);
    expect(requests).not.toContain("ruby:よ");
    expect(requests).not.toContain("ruby:み");
  });

  test("keeps an oversized shared cluster whole on a forced-overflow line", () => {
    const parsed = parseManuscript("あffiい");
    expect.assert(parsed.ok);
    const composer = createNovelComposer({
      measurer: (request) =>
        request.kind === "base" && request.text === "ffi"
          ? {
              kind: "clustered",
              advanceEm: 11,
              clusters: [
                {
                  textRange: MeasurementTextRange.of({ start: 0, end: 3 }),
                  layoutSpan: { offsetEm: 0, advanceEm: 11 },
                  renderSpan: { offsetEm: 0, advanceEm: 11 },
                },
              ],
            }
          : logicalRunMeasurer(request),
    });

    const result = composeManuscript(parsed.value, {
      composer,
      settings: {
        ...NovelCompositionSettings.defaults,
        flow: { lineLengthEm: 10, linesPerStage: 10, stagesPerPage: 1 },
      },
    });

    expect.assert(result.ok);
    const lines = result.value.layout.pages.flatMap(({ stages }) =>
      stages.flatMap(({ lines }) => lines.filter(({ range }) => range !== null)),
    );
    expect(
      lines.map((line) =>
        line.items
          .flatMap((item) =>
            item.kind === "glyph" || item.kind === "combined-glyph" ? [item.value] : [],
          )
          .join(""),
      ),
    ).toEqual(["あ", "ffi", "い"]);
    const overflow = lines[1];
    expect.assert(overflow !== undefined);
    expect(overflow.break.kind).toBe("forced");
    expect(overflow.inlineSizeEm).toBeGreaterThan(10);
  });

  test("returns a typed rejection for malformed cluster coverage", () => {
    const parsed = parseManuscript("ffi");
    expect.assert(parsed.ok);
    const composer = createNovelComposer({
      measurer: () => ({
        kind: "clustered",
        advanceEm: 1,
        clusters: [
          {
            textRange: MeasurementTextRange.of({ start: 0, end: 2 }),
            layoutSpan: { offsetEm: 0, advanceEm: 1 },
            renderSpan: { offsetEm: 0, advanceEm: 1 },
          },
        ],
      }),
    });

    const result = composeManuscript(parsed.value, {
      composer,
      settings: NovelCompositionSettings.defaults,
    });

    expect.assert(!result.ok);
    expect(result.error.kind).toBe("ComposerRejected");
  });

  test("refuses a group reading fragment that would bisect a provider cluster", () => {
    const parsed = parseManuscript(`｜${"漢".repeat(11)}《よみ》`, { parser: kakuyomuParser });
    expect.assert(parsed.ok);
    const composer = createNovelComposer({
      measurer: (request) =>
        request.kind === "ruby"
          ? {
              kind: "clustered",
              advanceEm: 12,
              clusters: [
                {
                  textRange: MeasurementTextRange.of({ start: 0, end: 2 }),
                  layoutSpan: { offsetEm: 0, advanceEm: 12 },
                  renderSpan: { offsetEm: 0, advanceEm: 12 },
                },
              ],
            }
          : logicalRunMeasurer(request),
    });

    const result = composeManuscript(parsed.value, {
      composer,
      settings: {
        ...NovelCompositionSettings.defaults,
        flow: { lineLengthEm: 10, linesPerStage: 10, stagesPerPage: 1 },
      },
    });

    expect.assert(!result.ok);
    expect(result.error.kind).toBe("ComposerRejected");
  });

  test("rejects annotation source bounds outside their line and association", () => {
    const line = compose("｜漢《よみ》")[0];
    expect.assert(line !== undefined);
    const ruby = line.annotations.find((annotation) => annotation.kind === "ruby");
    expect.assert(ruby !== undefined);
    const outsideLine = {
      ...ruby,
      fragmentRange: {
        ...ruby.fragmentRange,
        source: { start: 0, end: ruby.fragmentRange.source.end },
      },
    };
    const outsideAssociation = {
      ...ruby,
      fragmentRange: { ...ruby.fragmentRange, source: { start: 0, end: 100 } },
    };

    const lineResult = v.safeParse(NovelLine.schema, { ...line, annotations: [outsideLine] });
    const associationResult = v.safeParse(NovelLine.schema, {
      ...line,
      annotations: [outsideAssociation],
    });

    expect(lineResult.success).toBe(false);
    expect(associationResult.success).toBe(false);
    expect(v.safeParse(NovelLine.schema, { ...NovelLine.empty(), inlineSizeEm: 1 }).success).toBe(
      false,
    );
  });

  test("emits one positioned emphasis mark for a combined unit", () => {
    // pixiv emphasis can be supplied semantically without changing plain source identity.
    const parsed = parseManuscript("12");
    expect.assert(parsed.ok);
    const range = parsed.value.graphemes[0]?.range;
    expect.assert(range !== undefined);

    const result = composeManuscript(
      { ...parsed.value, annotations: [{ kind: "emphasis", range, mark: "・" }] },
      {
        composer: novelComposer,
        settings: NovelCompositionSettings.defaults,
      },
    );

    expect.assert(result.ok);
    const emphasis = result.value.layout.pages
      .flatMap(({ stages }) =>
        stages.flatMap(({ lines }) => lines.flatMap(({ annotations }) => annotations)),
      )
      .find((annotation) => annotation.kind === "emphasis");
    expect(emphasis).toMatchObject({
      placements: [
        {
          side: "before",
          inlineSpan: { offsetEm: 0, advanceEm: 1 },
          blockOffsetEm: -0.5,
          blockSizeEm: 0.5,
        },
      ],
    });
  });

  test("preserves an empty emphasis mark accepted by the parser contract", () => {
    const parsed = parseManuscript("字");
    expect.assert(parsed.ok);
    const member = parsed.value.graphemes[0];
    expect.assert(member !== undefined);

    const result = composeManuscript(
      { ...parsed.value, annotations: [{ kind: "emphasis", range: member.range, mark: "" }] },
      {
        composer: novelComposer,
        settings: NovelCompositionSettings.defaults,
      },
    );

    expect.assert(result.ok);
    const line = result.value.layout.pages[0]?.stages[0]?.lines[0];
    expect.assert(line !== undefined);
    expect(line.annotations).toContainEqual(
      expect.objectContaining({ kind: "emphasis", mark: "" }),
    );
  });

  test("rejects a line whose render units repeat or omit source members", () => {
    const line = compose("12")[0];
    expect.assert(line !== undefined);
    const unit = line.items.find((item) => item.kind === "combined-glyph");
    expect.assert(unit !== undefined);

    const duplicated = v.safeParse(NovelLine.schema, { ...line, items: [unit, unit] });
    const omitted = v.safeParse(NovelLine.schema, { ...line, items: [] });

    expect(duplicated.success).toBe(false);
    expect(omitted.success).toBe(false);
  });

  test("refuses colliding readings on two members of the same combined unit", () => {
    const parsed = parseManuscript("｜1《い》｜2《に》", { parser: kakuyomuParser });
    expect.assert(parsed.ok);

    const result = composeManuscript(parsed.value, {
      composer: novelComposer,
      settings: NovelCompositionSettings.defaults,
    });

    expect.assert(!result.ok);
    expect(result.error.kind).toBe("ComposerRejected");
  });
});
