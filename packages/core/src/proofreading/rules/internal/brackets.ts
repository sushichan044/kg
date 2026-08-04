/**
 * Brackets and quotes a Japanese paragraph may open with. Halfwidth forms are included because a
 * manuscript that uses them is still opening a paragraph, not writing prose.
 */
export const OPENING_BRACKETS = "「『〖〈《（(“\"‘'［[〔｛{＜<";

/**
 * The closing counterparts, in the same order.
 */
export const CLOSING_BRACKETS = "」』〗〉》）)”\"’'］]〕｝}＞>";

/**
 * Escapes the characters a regular expression character class would otherwise read as syntax, so a
 * set declared above can be dropped into a pattern.
 */
export function characterClass(characters: string): string {
  return characters.replaceAll(/[\\\]^-]/gu, "\\$&");
}
