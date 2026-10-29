import { expect, test } from "vite-plus/test";

import { parseManuscript } from "../parser/parse-manuscript";
import { composeManuscript } from "./compose-manuscript";
import { NovelCompositionSettings } from "./composition-settings";
import { CompositionRun } from "./internal/composition-run";
import { novelComposer } from "./novel-composer";

function compose(source: string, marks: string) {
  const parsed = parseManuscript(source);
  expect.assert(parsed.ok);
  const settings = NovelCompositionSettings.forPaper("a4", {
    ...NovelCompositionSettings.defaults,
    additionalSentenceEndingMarks: marks,
    flow: { lineLengthEm: 10, linesPerStage: 10, stagesPerPage: 1 },
  });

  const result = composeManuscript(parsed.value, { composer: novelComposer, settings });

  expect.assert(result.ok);
  return result.value.layout.pages.flatMap(({ stages }) => stages.flatMap(({ lines }) => lines));
}

test("separates configured ASCII marks from western words", () => {
  const parsed = parseManuscript("go+on");
  expect.assert(parsed.ok);

  const runs = CompositionRun.recognize(parsed.value.graphemes, "+");

  expect(runs.map(({ members }) => members.map(({ value }) => value).join(""))).toEqual([
    "go",
    "+",
    "on",
  ]);
  expect(runs[1]?.presentation).toBe("mixed");
});

test.each(["✧", "+", "❤️"])("gives configured %s a full-em cell", (mark) => {
  const lines = compose(`あ${mark}　次`, mark === "❤️" ? "❤" : mark);

  const glyph = lines
    .flatMap(({ items }) => items)
    .find((item) => item.kind === "glyph" && item.value === mark);
  expect.assert(glyph?.kind === "glyph");
  expect(glyph.layoutSpan.advanceEm).toBe(1);
});

test("allows a break after a configured ASCII mark", () => {
  const lines = compose(`${"a".repeat(18)}+on`, "+");

  expect(lines[0]?.range?.display.end).toBe(19);
  expect(lines[1]?.range?.display.start).toBe(19);
});

test("suppresses the separator after a variation-selector mark at a line edge", () => {
  const lines = compose(`${"あ".repeat(8)}❤️　次`, "❤");

  expect(lines.flatMap(({ items }) => items)).toContainEqual(
    expect.objectContaining({
      kind: "suppressed",
      value: "　",
    }),
  );
});
