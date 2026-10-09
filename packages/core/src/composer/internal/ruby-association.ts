import type { ManuscriptAnnotation } from "../../parser/annotation/manuscript-annotation";
import type { RubyReading } from "../../parser/annotation/ruby-annotation";
import type { ParsedGrapheme } from "../../parser/parsed-grapheme";
import type { ManuscriptRange } from "../../range/manuscript-range";

export type RubyAssociation = Readonly<{
  baseRange: ManuscriptRange;
  reading: RubyReading;
  indexes: readonly number[];
}>;

export const RubyAssociation = {
  collect: (
    annotations: readonly ManuscriptAnnotation[],
    graphemes: readonly ParsedGrapheme[],
  ): RubyAssociation[] =>
    annotations.flatMap((annotation) => {
      if (annotation.kind !== "ruby") return [];
      const first = graphemes[0];
      if (first === undefined) return [];
      const start = Math.max(0, annotation.range.graphemes.start - first.range.graphemes.start);
      const end = Math.min(
        graphemes.length,
        annotation.range.graphemes.end - first.range.graphemes.start,
      );
      const indexes = Array.from({ length: Math.max(0, end - start) }, (_, index) => start + index);
      return indexes.length === 0
        ? []
        : [{ baseRange: annotation.range, reading: annotation.reading, indexes }];
    }),
  fittableInteriors: (
    associations: readonly RubyAssociation[],
    advancesEm: readonly number[],
    lineLengthEm: number,
    fittableGroups?: ReadonlySet<RubyAssociation>,
  ): ReadonlySet<number> => {
    const interiors = new Set<number>();
    for (const association of associations) {
      if (association.reading.kind !== "group") continue;
      if (fittableGroups !== undefined && !fittableGroups.has(association)) continue;
      const first = association.indexes[0];
      const last = association.indexes.at(-1);
      if (first === undefined || last === undefined) continue;
      const advanceEm = association.indexes.reduce(
        (total, index) => total + (advancesEm[index] ?? 0),
        0,
      );
      if (advanceEm > lineLengthEm) continue;
      for (let boundary = first + 1; boundary <= last; boundary += 1) interiors.add(boundary);
    }
    return interiors;
  },
} as const;
