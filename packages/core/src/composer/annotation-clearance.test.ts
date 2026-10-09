import { describe, expect, test } from "vite-plus/test";

import type { ManuscriptAnnotation } from "../parser/annotation/manuscript-annotation";
import { parseManuscript } from "../parser/parse-manuscript";
import { ManuscriptRange } from "../range/manuscript-range";
import { composeManuscript } from "./compose-manuscript";
import { NovelCompositionSettings } from "./composition-settings";
import { MeasurementTextRange } from "./measurement-text-range";
import { createNovelComposer, novelComposer } from "./novel-composer";
import { logicalRunMeasurer } from "./run-measurer";

type Decoration = Readonly<{
  start: number;
  length: number;
  annotation:
    | Readonly<{ kind: "ruby"; text: string }>
    | Readonly<{ kind: "emphasis"; mark: string }>;
}>;

function composeDecorations(
  text: string,
  decorations: readonly Decoration[],
  composer = novelComposer,
) {
  const parsed = parseManuscript(text);
  expect.assert(parsed.ok);
  const annotations: ManuscriptAnnotation[] = decorations.map(({ start, length, annotation }) => {
    const range = ManuscriptRange.merge(
      parsed.value.graphemes.slice(start, start + length).map((grapheme) => grapheme.range),
    );
    expect.assert(range !== null);
    return annotation.kind === "ruby"
      ? { kind: "ruby", range, reading: { kind: "group", text: annotation.text } }
      : { ...annotation, range };
  });

  return composeManuscript(
    { ...parsed.value, annotations },
    {
      composer,
      settings: {
        ...NovelCompositionSettings.defaults,
        flow: { lineLengthEm: 10, linesPerStage: 10, stagesPerPage: 1 },
      },
    },
  );
}

describe("fixed-pitch decoration clearance", () => {
  test("refuses ruby and emphasis that occupy the same base position", () => {
    const result = composeDecorations("漢", [
      { start: 0, length: 1, annotation: { kind: "ruby", text: "かん" } },
      { start: 0, length: 1, annotation: { kind: "emphasis", mark: "・" } },
    ]);

    expect.assert(!result.ok);
    expect(result.error).toMatchObject({
      kind: "ComposerRejected",
      reason: expect.stringContaining("annotation"),
    });
  });

  test("checks the physical combined unit even when annotation source ranges are disjoint", () => {
    const result = composeDecorations("12", [
      { start: 0, length: 1, annotation: { kind: "ruby", text: "い" } },
      { start: 1, length: 1, annotation: { kind: "emphasis", mark: "・" } },
    ]);

    expect.assert(!result.ok);
    expect(result.error.kind).toBe("ComposerRejected");
  });

  test("chooses a different line break when overhang would collide with the next emphasis mark", () => {
    const result = composeDecorations("漢あ", [
      { start: 0, length: 1, annotation: { kind: "ruby", text: "かんじ" } },
      { start: 1, length: 1, annotation: { kind: "emphasis", mark: "・" } },
    ]);

    expect.assert(result.ok);
    const lines = result.value.layout.pages.flatMap((page) =>
      page.stages.flatMap((stage) => stage.lines.filter((line) => line.range !== null)),
    );
    expect(lines).toHaveLength(2);
    expect(
      result.value.layout.geometry.lineGapMm / result.value.layout.geometry.cellSizeMm,
    ).toBeCloseTo(0.5, 10);
  });

  test("preserves one line and the center of a compatible emphasis mark", () => {
    const result = composeDecorations("漢あ", [
      { start: 0, length: 1, annotation: { kind: "ruby", text: "かん" } },
      { start: 1, length: 1, annotation: { kind: "emphasis", mark: "・" } },
    ]);

    expect.assert(result.ok);
    const lines = result.value.layout.pages.flatMap((page) =>
      page.stages.flatMap((stage) => stage.lines.filter((line) => line.range !== null)),
    );
    const emphasis = lines[0]?.annotations.find((annotation) => annotation.kind === "emphasis");
    expect.assert(emphasis !== undefined);
    expect(lines).toHaveLength(1);
    expect(emphasis.placements).toEqual([
      {
        side: "before",
        inlineSpan: { offsetEm: 1.25, advanceEm: 0.5 },
        blockOffsetEm: -0.5,
        blockSizeEm: 0.5,
      },
    ]);
  });

  test("omits emphasis on brackets, commas, and full stops", () => {
    const result = composeDecorations("「漢、字。」", [
      { start: 0, length: 6, annotation: { kind: "emphasis", mark: "・" } },
    ]);

    expect.assert(result.ok);
    const emphasis = result.value.layout.pages.flatMap((page) =>
      page.stages.flatMap((stage) =>
        stage.lines.flatMap((line) =>
          line.annotations.filter((annotation) => annotation.kind === "emphasis"),
        ),
      ),
    );
    expect(emphasis.flatMap((fragment) => fragment.placements)).toHaveLength(2);
  });

  test("does not reserve ink for an empty emphasis mark", () => {
    const result = composeDecorations("漢", [
      { start: 0, length: 1, annotation: { kind: "ruby", text: "かん" } },
      { start: 0, length: 1, annotation: { kind: "emphasis", mark: "" } },
    ]);

    expect(result.ok).toBe(true);
  });

  test("refuses collisions even when the provider forces the combined base beyond the line", () => {
    const composer = createNovelComposer({
      measurer: (request) =>
        request.kind === "base" && request.text === "ffi"
          ? {
              kind: "clustered",
              advanceEm: 12,
              clusters: [
                {
                  textRange: MeasurementTextRange.of({ start: 0, end: 3 }),
                  layoutSpan: { offsetEm: 0, advanceEm: 12 },
                  renderSpan: { offsetEm: 0, advanceEm: 12 },
                },
              ],
            }
          : logicalRunMeasurer(request),
    });

    const result = composeDecorations(
      "ffi",
      [
        { start: 0, length: 3, annotation: { kind: "ruby", text: "よ" } },
        { start: 0, length: 3, annotation: { kind: "emphasis", mark: "・" } },
      ],
      composer,
    );

    expect.assert(!result.ok);
    expect(result.error.kind).toBe("ComposerRejected");
  });
});
