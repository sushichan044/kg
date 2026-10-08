import { describe, expect, test } from "vite-plus/test";

import { kakuyomuParser } from "../../parser/kakuyomu-parser";
import { parseManuscript } from "../../parser/parse-manuscript";
import { CompositionRun } from "./composition-run";
import { RubyAssociation } from "./ruby-association";
import { SourceSpace } from "./source-space";

describe("composition associations", () => {
  test("keeps a ruby association across independently recognized runs", () => {
    const parsed = parseManuscript("｜漢12字《かんじ》", { parser: kakuyomuParser });
    expect.assert(parsed.ok, "fixture did not parse");

    const runs = CompositionRun.recognize(parsed.value.graphemes);
    const associations = RubyAssociation.collect(parsed.value.annotations, parsed.value.graphemes);

    expect(
      runs.map(({ presentation, members }) => [
        presentation,
        members.map(({ value }) => value).join(""),
      ]),
    ).toEqual([
      ["mixed", "漢"],
      ["tate-chu-yoko", "12"],
      ["mixed", "字"],
    ]);
    expect(runs.flatMap(({ members }) => members)).toEqual(parsed.value.graphemes);
    expect(associations).toHaveLength(1);
    expect(associations[0]).toMatchObject({
      indexes: [0, 1, 2, 3],
      reading: { kind: "group", text: "かんじ" },
    });
    const association = associations[0];
    const annotation = parsed.value.annotations[0];
    expect.assert(association !== undefined, "ruby association is missing");
    expect.assert(annotation !== undefined, "parsed annotation is missing");
    expect(association.baseRange).toEqual(annotation.range);
  });

  test("keeps a ruby on the first digit of a combined run", () => {
    const parsed = parseManuscript("｜1《いち》2", { parser: kakuyomuParser });
    expect.assert(parsed.ok, "fixture did not parse");

    const runs = CompositionRun.recognize(parsed.value.graphemes);
    const associations = RubyAssociation.collect(parsed.value.annotations, parsed.value.graphemes);

    expect(runs).toHaveLength(1);
    const run = runs[0];
    const association = associations[0];
    const base = parsed.value.graphemes[0];
    expect.assert(run !== undefined, "combined run is missing");
    expect.assert(association !== undefined, "ruby association is missing");
    expect.assert(base !== undefined, "base grapheme is missing");
    expect(run.presentation).toBe("tate-chu-yoko");
    expect(association.indexes).toEqual([0]);
    expect(association.baseRange.display).toEqual(base.range.display);
    expect(association.baseRange.graphemes).toEqual(base.range.graphemes);
  });

  test("retains source identity and distinct edge behavior for authored spaces", () => {
    const parsed = parseManuscript("　？　spring rain");
    expect.assert(parsed.ok, "fixture did not parse");

    const spaces = SourceSpace.collect(
      parsed.value.graphemes,
      parsed.value.graphemes.map(() => 1),
    );

    expect(
      spaces.map(({ purpose, edgeBehavior, naturalWidthEm }) => ({
        purpose,
        edgeBehavior,
        naturalWidthEm,
      })),
    ).toEqual([
      { purpose: "ideographic", edgeBehavior: "preserve", naturalWidthEm: 1 },
      { purpose: "question-or-exclamation-separator", edgeBehavior: "suppress", naturalWidthEm: 1 },
      { purpose: "western-word", edgeBehavior: "zero", naturalWidthEm: 1 / 3 },
    ]);
    expect(spaces.every((space) => space.grapheme === parsed.value.graphemes[space.index])).toBe(
      true,
    );
  });
});
