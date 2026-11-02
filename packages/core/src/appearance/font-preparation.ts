import * as v from "valibot";

import { graphemeSegmenter } from "../internal/segmenter";
import type { ManuscriptAnnotation } from "../parser/annotation/manuscript-annotation";
import type { ParsedGrapheme } from "../parser/parsed-grapheme";
import { ParsedManuscript } from "../parser/parsed-manuscript";
import { ManuscriptRange } from "../range/manuscript-range";
import { FontPreset } from "./font-preset";
import type { FontPresetId } from "./font-preset-id";
import { applyFontTextTransforms } from "./internal/font-text-transforms";

export type PreparedFontManuscript = Readonly<{
  parsed: ParsedManuscript;
  mapRange: (range: ManuscriptRange) => ManuscriptRange;
}>;

export function prepareTextForFont(text: string, fontPreset: FontPresetId): string {
  return applyFontTextTransforms(text, FontPreset.of(fontPreset).textTransforms);
}

/**
 * Prepare display text after parsing; source and UTF-16 offsets remain unchanged.
 */
export function prepareManuscriptForFont(
  parsed: ParsedManuscript,
  fontPreset: FontPresetId,
): PreparedFontManuscript {
  if (FontPreset.of(fontPreset).textTransforms.length === 0)
    return { parsed, mapRange: (range) => range };

  const boundaries = new Set([0, parsed.displayText.length]);
  for (const annotation of parsed.annotations) {
    boundaries.add(annotation.range.display.start);
    boundaries.add(annotation.range.display.end);
    if (annotation.kind === "ruby" && annotation.reading.kind !== "group") {
      for (const member of parsed.graphemes.slice(
        annotation.range.graphemes.start,
        annotation.range.graphemes.end,
      ))
        boundaries.add(member.range.display.start);
    }
  }
  for (const [index, member] of parsed.graphemes.entries()) {
    const previous = parsed.graphemes[index - 1];
    if (previous !== undefined && previous.range.source.end !== member.range.source.start)
      boundaries.add(member.range.display.start);
  }
  const ordered = [...boundaries].sort((a, b) => a - b);
  const parts: string[] = [];
  const graphemes: ParsedGrapheme[] = [];
  let originalIndex = 0;
  for (let i = 1; i < ordered.length; i += 1) {
    const start = ordered[i - 1];
    const end = ordered[i];
    if (start === undefined || end === undefined) continue;
    const text = prepareTextForFont(parsed.displayText.slice(start, end), fontPreset);
    parts.push(text);
    for (const { segment, index } of graphemeSegmenter.segment(text)) {
      const displayStart = start + index;
      const displayEnd = displayStart + segment.length;
      while ((parsed.graphemes[originalIndex]?.range.display.end ?? Infinity) <= displayStart)
        originalIndex += 1;
      const first = parsed.graphemes[originalIndex];
      let last = first;
      while (last !== undefined && last.range.display.end < displayEnd) {
        originalIndex += 1;
        last = parsed.graphemes[originalIndex];
      }
      if (first === undefined || last === undefined)
        throw new Error("Font preparation lost a source member");
      graphemes.push({
        value: segment,
        range: ManuscriptRange.of({
          source: { start: first.range.source.start, end: last.range.source.end },
          display: { start: displayStart, end: displayEnd },
          graphemes: { start: graphemes.length, end: graphemes.length + 1 },
        }),
      });
    }
  }

  const boundaryIndex = (offset: number, end: boolean): number => {
    let low = 0;
    let high = graphemes.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const member = graphemes[mid];
      if (
        member !== undefined &&
        (end ? member.range.display.start < offset : member.range.display.end <= offset)
      )
        low = mid + 1;
      else high = mid;
    }
    return low;
  };
  const mapRange = (range: ManuscriptRange): ManuscriptRange => {
    const start = boundaryIndex(range.display.start, false);
    return ManuscriptRange.of({
      ...range,
      graphemes: {
        start,
        end:
          range.display.start === range.display.end
            ? start
            : boundaryIndex(range.display.end, true),
      },
    });
  };
  const annotations = parsed.annotations.map((annotation): ManuscriptAnnotation => {
    const range = mapRange(annotation.range);
    if (annotation.kind !== "ruby") return { ...annotation, range };
    const reading =
      annotation.reading.kind === "group"
        ? { kind: "group" as const, text: prepareTextForFont(annotation.reading.text, fontPreset) }
        : {
            ...annotation.reading,
            segments: annotation.reading.segments.map((text) =>
              prepareTextForFont(text, fontPreset),
            ),
          };
    return { ...annotation, range, reading };
  });
  return {
    parsed: v.parse(ParsedManuscript.contractFor(parsed.source), {
      source: parsed.source,
      displayText: parts.join(""),
      graphemes,
      annotations,
    }),
    mapRange,
  };
}
