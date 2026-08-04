const DECORATION_LINE = /^[＊*◆◇■□●○▽▼△▲☆★・…―─━ー\-=＝~～\s]+$/u;

/**
 * A line made only of symbols and spaces: a scene break or a section marker rather than a
 * paragraph. Indentation rules skip these, because their layout is deliberate.
 */
export function isDecorationLine(text: string): boolean {
  return DECORATION_LINE.test(text);
}
