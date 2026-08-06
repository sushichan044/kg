export const JAPANESE_CHARACTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ヵヶ]/u;

/**
 * Whether a halfwidth mark at `index` sits beside Japanese prose, which is what makes some
 * halfwidth marks wrong there even though the same mark is correct in Latin text.
 */
export function isBesideJapanese(text: string, index: number): boolean {
  const before = text[index - 1];
  const after = text[index + 1];

  return (
    (before !== undefined && JAPANESE_CHARACTER.test(before)) ||
    (after !== undefined && JAPANESE_CHARACTER.test(after))
  );
}
