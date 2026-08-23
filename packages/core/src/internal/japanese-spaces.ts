const LEADING_SPACES = /^[　 \t]+/u;

/**
 * The one space a Japanese manuscript indents with, and the only gap allowed after ！ or ？.
 */
export const IDEOGRAPHIC_SPACE = "　";

/**
 * The run of spaces the text begins with, or an empty string. Halfwidth spaces and tabs count: a
 * rule has to see them to say they are the wrong space.
 */
export function leadingSpaces(text: string): string {
  return LEADING_SPACES.exec(text)?.[0] ?? "";
}
