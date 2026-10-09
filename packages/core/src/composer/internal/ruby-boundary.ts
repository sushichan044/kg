import type { JapaneseCharacterClass } from "./japanese-typesetting-rules";

export type RubyBoundary = Readonly<{
  lexicalClass: JapaneseCharacterClass;
  effectiveClass: JapaneseCharacterClass | "cl-22" | "cl-23";
  advanceEm: number;
}>;

export const RubyBoundary = {
  // JLReq 3.3.8: punctuation whitespace depends on its side and resolved spacing.
  overhang: (
    neighbor: RubyBoundary | undefined,
    side: "before" | "after",
    spacingEm: number,
  ): number => {
    if (
      neighbor === undefined ||
      neighbor.effectiveClass === "cl-22" ||
      neighbor.effectiveClass === "cl-23"
    )
      return 0;
    const { lexicalClass, advanceEm } = neighbor;
    if (["cl-08", "cl-10", "cl-11", "cl-15", "cl-16"].some((value) => value === lexicalClass))
      return Math.min(0.5, advanceEm);
    if (lexicalClass === "cl-05") return Math.min(0.5, Math.max(0, spacingEm) + 0.25);
    const closing =
      lexicalClass === "cl-02" || lexicalClass === "cl-06" || lexicalClass === "cl-07";
    if ((side === "before" && closing) || (side === "after" && lexicalClass === "cl-01"))
      return Math.min(0.5, Math.max(0, spacingEm));
    if ((side === "after" && closing) || (side === "before" && lexicalClass === "cl-01"))
      return Math.min(0.5, advanceEm);
    return 0;
  },
} as const;
