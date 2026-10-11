import { describe, expect, test } from "vite-plus/test";

import { parseManuscript } from "../parser/parse-manuscript";
import { composeManuscript } from "./compose-manuscript";
import { NovelCompositionSettings } from "./composition-settings";
import { MeasurementTextRange } from "./measurement-text-range";
import { createNovelComposer } from "./novel-composer";
import type { RunMeasurer } from "./run-measurer";
import { logicalRunMeasurer } from "./run-measurer";

/**
 * Nonuniform advances expose source-position errors when a measured run is split.
 */
function metricsProvider(advanceEm = 2.4, requests: string[] = []): RunMeasurer {
  const spans = [
    { offsetEm: 0, advanceEm: 0.7 },
    { offsetEm: 0.7, advanceEm: 0.5 },
    { offsetEm: 1.2, advanceEm: 0.3 },
    { offsetEm: 1.5, advanceEm: 0.6 },
    { offsetEm: 2.1, advanceEm: 0.3 },
  ];
  return (request) => {
    requests.push(request.text);
    if (request.kind !== "base" || request.text !== "water") return logicalRunMeasurer(request);
    return {
      kind: "clustered",
      advanceEm,
      clusters: spans.map((span, index) => ({
        textRange: MeasurementTextRange.of({ start: index, end: index + 1 }),
        layoutSpan: {
          offsetEm: span.offsetEm * (advanceEm / 2.4),
          advanceEm: span.advanceEm * (advanceEm / 2.4),
        },
        renderSpan: {
          offsetEm: span.offsetEm * (advanceEm / 2.4),
          advanceEm: span.advanceEm * (advanceEm / 2.4),
        },
      })),
    };
  };
}

/**
 * Direct annotations isolate placement regressions from notation parsing.
 */
function compose(text: string, measurer: RunMeasurer, partialAnnotation?: "bold" | "ruby") {
  const parsed = parseManuscript(text);
  expect.assert(parsed.ok);
  const first = parsed.value.graphemes[0];
  expect.assert(first !== undefined);
  const manuscript = partialAnnotation
    ? {
        ...parsed.value,
        annotations: [
          partialAnnotation === "bold"
            ? ({ kind: "bold", range: first.range } as const)
            : ({
                kind: "ruby",
                range: first.range,
                reading: { kind: "mono", segments: ["わ"] },
              } as const),
        ],
      }
    : parsed.value;

  const result = composeManuscript(manuscript, {
    composer: createNovelComposer({ measurer }),
    settings: {
      ...NovelCompositionSettings.defaults,
      flow: { ...NovelCompositionSettings.defaults.flow, lineLengthEm: 10 },
    },
  });

  expect.assert(result.ok);
  return result.value.layout.pages.flatMap(({ stages }) =>
    stages.flatMap(({ lines }) => lines.filter(({ range }) => range !== null)),
  );
}

describe("Western run metrics", () => {
  test("draws a measured Western run together while retaining exact member positions", () => {
    const requests: string[] = [];

    const lines = compose("water", metricsProvider(2.4, requests));

    const units = lines
      .flatMap(({ items }) => items)
      .filter((item) => item.kind === "combined-glyph");
    expect(units).toHaveLength(1);
    const unit = units[0];
    expect.assert(unit !== undefined);
    expect(unit.value).toBe("water");
    expect(unit.presentation).toBe("sideways");
    expect(unit.layoutSpan.advanceEm).toBeCloseTo(2.4, 10);
    expect(unit.sources.map(({ kind }) => kind)).toEqual(Array.from({ length: 5 }, () => "exact"));
    expect(unit.sources.map(({ layoutSpan }) => layoutSpan.offsetEm)).toEqual([
      0, 0.7, 1.2, 1.5, 2.1,
    ]);
    expect(requests).toEqual(["water"]);
  });

  test("uses measured run width before choosing a paragraph break", () => {
    const text = "漢漢漢漢漢漢漢water字";

    const narrow = compose(text, metricsProvider(2.4));
    const wide = compose(text, metricsProvider(2.9));

    expect(
      narrow[0]?.items.some((item) => item.kind === "combined-glyph" && item.value === "water"),
    ).toBe(true);
    expect(
      wide[0]?.items.some((item) => item.kind === "combined-glyph" && item.value === "water"),
    ).toBe(false);
    expect(
      wide[1]?.items.some((item) => item.kind === "combined-glyph" && item.value === "water"),
    ).toBe(true);
  });

  test("retains separate glyphs where a partial style would change the combined run", () => {
    const lines = compose("water", metricsProvider(), "bold");

    expect(
      lines.flatMap(({ items }) => items).filter((item) => item.kind === "glyph"),
    ).toHaveLength(5);
  });

  test("keeps a partial mono ruby anchored to its measured Western character", () => {
    const lines = compose("water", metricsProvider(), "ruby");

    const glyphs = lines.flatMap(({ items }) => items).filter((item) => item.kind === "glyph");
    const ruby = lines
      .flatMap(({ annotations }) => annotations)
      .find((item) => item.kind === "ruby");
    expect(glyphs).toHaveLength(5);
    expect.assert(ruby?.kind === "ruby");
    expect(ruby.fragmentRange.graphemes).toEqual({ start: 0, end: 1 });
    expect(ruby.readingItems[0]?.placement.inlineSpan.offsetEm).toBeCloseTo(0.1);
  });

  test("retains per-grapheme rendering for aggregate logical measurements", () => {
    const lines = compose("water", logicalRunMeasurer);

    expect(
      lines.flatMap(({ items }) => items).filter((item) => item.kind === "glyph"),
    ).toHaveLength(5);
  });
});
