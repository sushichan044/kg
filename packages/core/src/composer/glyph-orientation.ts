import * as v from "valibot";

import { verticalOrientationOf } from "../internal/vertical-orientation";
import type { PresentationKind } from "./presentation-kind";

const GlyphOrientationSchema = v.picklist(["upright", "sideways"]);

/**
 * 縦組で 1 書記素を描く向き
 *
 * `sideways` は時計回りに 90 度倒す
 */
export type GlyphOrientation = v.InferOutput<typeof GlyphOrientationSchema>;

// 絵文字として表示する書記素は、基底の文字が欧文の記号でも絵として正立させる
const EMOJI_PRESENTATION = /[\u{FE0F}\u{20E3}]/u;

function resolveMixed(grapheme: string): GlyphOrientation {
  const base = grapheme.codePointAt(0);
  if (base === undefined) throw new RangeError("A grapheme must not be empty");
  if (EMOJI_PRESENTATION.test(grapheme)) return "upright";
  // Tu と Tr は縦組用の字形への置き換えを前提とする値で、置き換えは正立で描くときだけ働く
  return verticalOrientationOf(base) === "R" ? "sideways" : "upright";
}

export const GlyphOrientation = {
  schema: GlyphOrientationSchema,

  /**
   * `mixed` の書記素は、基底の文字の Vertical_Orientation（UAX #50）で向きを決める
   */
  of: (
    grapheme: string,
    presentation: Exclude<PresentationKind, "tate-chu-yoko">,
  ): GlyphOrientation => (presentation === "mixed" ? resolveMixed(grapheme) : presentation),
} as const;
