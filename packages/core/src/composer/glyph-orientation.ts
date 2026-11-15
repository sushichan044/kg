import { UPRIGHT_RANGES } from "./internal/vertical-orientation-table";
import type { PresentationKind } from "./presentation-kind";

export type GlyphOrientation = "upright" | "sideways";

const EMOJI_PRESENTATION_SELECTOR = "\uFE0F";

function isUprightInMixed(codePoint: number): boolean {
  let low = 0;
  let high = UPRIGHT_RANGES.length / 2 - 1;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    const start = UPRIGHT_RANGES[mid * 2]!;
    const end = UPRIGHT_RANGES[mid * 2 + 1]!;

    if (codePoint < start) high = mid - 1;
    else if (codePoint > end) low = mid + 1;
    else return true;
  }

  return false;
}

// Chrome は U+FE0F を含む書記素を基底文字の Vertical_Orientation に関わらず正立で描く（`1️⃣` も同様）
// U+20E3 だけの `1⃣` は基底文字 `1`（R）のまま横倒しになる
export function resolveGlyphOrientation(
  grapheme: string,
  presentation: Exclude<PresentationKind, "tate-chu-yoko">,
): GlyphOrientation {
  if (presentation !== "mixed") return presentation;

  const base = grapheme.codePointAt(0);
  if (base === undefined) throw new RangeError("grapheme must not be empty");

  if (grapheme.includes(EMOJI_PRESENTATION_SELECTOR)) return "upright";

  return isUprightInMixed(base) ? "upright" : "sideways";
}
