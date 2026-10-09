import type { ParsedManuscript } from "../../parser/parsed-manuscript";
import type { ManuscriptRange } from "../../range/manuscript-range";
import type { NovelLine } from "../novel-line";
import { PositionedInlineItem } from "../positioned-inline-item";
import { SourcePlacement } from "../source-placement";

function sameRange(left: ManuscriptRange, right: ManuscriptRange): boolean {
  return (
    left.source.start === right.source.start &&
    left.source.end === right.source.end &&
    left.display.start === right.display.start &&
    left.display.end === right.display.end &&
    left.graphemes.start === right.graphemes.start &&
    left.graphemes.end === right.graphemes.end
  );
}

export const NovelSourceContract = {
  matches: (manuscript: ParsedManuscript, lines: readonly NovelLine[]): boolean => {
    const expected = manuscript.graphemes.filter(
      ({ value }) => !["\n", "\r", "\r\n"].includes(value),
    );
    const members = new Map(expected.map((grapheme) => [grapheme.range.graphemes.start, grapheme]));
    const seen = new Set<number>();
    for (const line of lines) {
      for (const item of line.items) {
        const ranges = PositionedInlineItem.isRenderUnit(item)
          ? item.sources.flatMap(SourcePlacement.ranges)
          : item.kind === "suppressed" || (item.kind === "glue" && item.origin === "source")
            ? [item.range]
            : [];
        if (ranges.length === 0) continue;
        if (
          !("value" in item) ||
          item.value !==
            manuscript.displayText.slice(item.range.display.start, item.range.display.end)
        )
          return false;
        for (const range of ranges) {
          const member = members.get(range.graphemes.start);
          if (
            member === undefined ||
            seen.has(range.graphemes.start) ||
            !sameRange(member.range, range)
          )
            return false;
          seen.add(range.graphemes.start);
        }
      }
    }
    if (seen.size !== expected.length) return false;
    const fragments = lines.flatMap(({ annotations }) => annotations);
    return manuscript.annotations.every((annotation) => {
      if (annotation.kind !== "ruby") return true;
      const reading =
        annotation.reading.kind === "group"
          ? annotation.reading.text
          : annotation.reading.segments.join("");
      return (
        fragments
          .filter(
            (fragment) =>
              fragment.kind === "ruby" && sameRange(fragment.annotationRange, annotation.range),
          )
          .map((fragment) => (fragment.kind === "ruby" ? fragment.reading : ""))
          .join("") === reading
      );
    });
  },
} as const;
