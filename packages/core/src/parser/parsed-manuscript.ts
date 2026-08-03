import * as v from "valibot";

import { readonlyArray, readonlyObject } from "../internal/schema";
import type { ManuscriptRange } from "../range/manuscript-range";
import { ManuscriptAnnotation } from "./annotation/manuscript-annotation";
import { ParsedGrapheme } from "./parsed-grapheme";

const ParsedManuscriptSchema = readonlyObject({
  source: v.string(),
  displayText: v.string(),
  graphemes: readonlyArray(ParsedGrapheme.schema),
  annotations: readonlyArray(ManuscriptAnnotation.schema),
});

/**
 * Source text with service-specific notation normalised away, plus the mapping back to it.
 */
export type ParsedManuscript = v.InferOutput<typeof ParsedManuscriptSchema>;

function rangeFits(range: ManuscriptRange, manuscript: ParsedManuscript): boolean {
  return (
    range.source.end <= manuscript.source.length &&
    range.display.end <= manuscript.displayText.length &&
    range.graphemes.end <= manuscript.graphemes.length
  );
}

function isConsistent(manuscript: ParsedManuscript, source: string): boolean {
  const joined = manuscript.graphemes.map(({ value }) => value).join("");
  const sequential = manuscript.graphemes.every(
    ({ range }, index) =>
      range.graphemes.start === index &&
      range.graphemes.end === index + 1 &&
      rangeFits(range, manuscript),
  );

  return (
    manuscript.source === source &&
    manuscript.displayText === joined &&
    sequential &&
    manuscript.annotations.every(({ range }) => rangeFits(range, manuscript))
  );
}

const CONTRACT_MESSAGE =
  "parser output must contain consistent source, display, grapheme, and annotation ranges";

export const ParsedManuscript = {
  schema: ParsedManuscriptSchema,

  /**
   * The parser contract as a schema: shape, plus the cross-field invariants that make the three
   * coordinate systems line up. Annotations come out in a stable order regardless of parser.
   */
  contractFor: (source: string): v.GenericSchema<unknown, ParsedManuscript> =>
    v.pipe(
      ParsedManuscriptSchema,
      v.check((manuscript) => isConsistent(manuscript, source), CONTRACT_MESSAGE),
      v.transform((manuscript) => ({
        ...manuscript,
        annotations: [...manuscript.annotations].sort(ManuscriptAnnotation.compare),
      })),
    ),
} as const;
