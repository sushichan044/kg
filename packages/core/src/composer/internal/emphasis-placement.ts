import type { AnnotationPlacement } from "../annotation-placement";
import type { InlineSpan } from "../inline-span";
import { defaultBookStyle } from "./book-style";
import type { JapaneseCharacterClass } from "./japanese-typesetting-rules";

const { sizeEm } = defaultBookStyle.annotation;

export const EmphasisPlacement = {
  accepts: (characterClass: JapaneseCharacterClass | undefined): boolean =>
    characterClass !== undefined &&
    !["cl-01", "cl-02", "cl-06", "cl-07"].some((value) => value === characterClass),
  of: (base: InlineSpan): AnnotationPlacement => ({
    side: "before",
    inlineSpan: { offsetEm: base.offsetEm + (base.advanceEm - sizeEm) / 2, advanceEm: sizeEm },
    blockOffsetEm: -sizeEm,
    blockSizeEm: sizeEm,
  }),
} as const;
