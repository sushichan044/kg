import type { AnnotationPlacement } from "../annotation-placement";
import { defaultBookStyle } from "./book-style";

const EPSILON = 1e-9;

export type AnnotationClearance =
  | Readonly<{ kind: "clear" }>
  | Readonly<{ kind: "refused"; reason: string }>;

function overlaps(left: AnnotationPlacement, right: AnnotationPlacement): boolean {
  return (
    left.inlineSpan.offsetEm < right.inlineSpan.offsetEm + right.inlineSpan.advanceEm - EPSILON &&
    right.inlineSpan.offsetEm < left.inlineSpan.offsetEm + left.inlineSpan.advanceEm - EPSILON &&
    left.blockOffsetEm < right.blockOffsetEm + right.blockSizeEm - EPSILON &&
    right.blockOffsetEm < left.blockOffsetEm + left.blockSizeEm - EPSILON
  );
}

export const AnnotationClearance = {
  resolve: (areas: ReadonlyArray<readonly AnnotationPlacement[]>): AnnotationClearance => {
    for (const area of areas) {
      if (
        area.some(
          (placement) =>
            placement.side !== "before" ||
            placement.blockOffsetEm < defaultBookStyle.annotation.areaStartEm - EPSILON ||
            placement.blockOffsetEm + placement.blockSizeEm >
              defaultBookStyle.annotation.areaEndEm + EPSILON,
        )
      )
        return { kind: "refused", reason: "annotation exceeds the fixed half-em right-side area" };
    }
    for (const [index, area] of areas.entries()) {
      if (
        areas
          .slice(index + 1)
          .some((other) => area.some((left) => other.some((right) => overlaps(left, right))))
      )
        return {
          kind: "refused",
          reason: "annotation readings or emphasis marks overlap in the fixed right-side area",
        };
    }
    return { kind: "clear" };
  },
} as const;
