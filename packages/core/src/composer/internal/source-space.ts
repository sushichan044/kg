import { questionOrExclamationSpacings } from "../../internal/question-or-exclamation-spacing";
import type { ParsedGrapheme } from "../../parser/parsed-grapheme";

export type SourceSpace = Readonly<{
  grapheme: ParsedGrapheme;
  index: number;
  purpose: "ideographic" | "question-or-exclamation-separator" | "western-word";
  naturalWidthEm: number;
  edgeBehavior: "preserve" | "suppress" | "zero";
}>;

export const SourceSpace = {
  collect: (graphemes: readonly ParsedGrapheme[], advancesEm: readonly number[]): SourceSpace[] => {
    const gaps = new Set(
      questionOrExclamationSpacings(graphemes.map(({ value }) => value).join(""))
        .filter((spacing) => spacing.kind === "valid")
        .map(({ gap }) => gap.start),
    );
    let offset = 0;
    return graphemes.flatMap<SourceSpace>((grapheme, index) => {
      const separator = gaps.has(offset);
      offset += grapheme.value.length;
      if (separator)
        return [
          {
            grapheme,
            index,
            purpose: "question-or-exclamation-separator",
            naturalWidthEm: advancesEm[index] ?? 0,
            edgeBehavior: "suppress",
          } as const,
        ];
      if (grapheme.value === "　")
        return [
          {
            grapheme,
            index,
            purpose: "ideographic",
            naturalWidthEm: advancesEm[index] ?? 0,
            edgeBehavior: "preserve",
          } as const,
        ];
      if (grapheme.value === " ")
        return [
          {
            grapheme,
            index,
            purpose: "western-word",
            naturalWidthEm: 1 / 3,
            edgeBehavior: "zero",
          } as const,
        ];
      return [];
    });
  },
} as const;
