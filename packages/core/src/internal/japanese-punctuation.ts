/**
 * JLReq cl-04 occupies a full em, including compound marks whose Unicode East Asian Width is
 * neutral.
 */
export const DIVIDING_PUNCTUATION = "！？‼⁇⁈⁉";

/**
 * The marks a short run of which is set as one tate-chu-yoko cell, `！？` reading as `⁉`.
 */
export const TATE_CHU_YOKO_MARKS = "!?！？";

export const SENTENCE_ENDING_MARKS = `${DIVIDING_PUNCTUATION}♡♪☆`;
export const validAdditionalSentenceEndingMarks = (value: string): boolean =>
  /^[\p{S}]*$/u.test(value);

/**
 * Match one symbol grapheme, allowing its text or emoji variation selector.
 */
export function isSentenceEndingMark(grapheme: string, additionalMarks = ""): boolean {
  const symbol = grapheme.replace(/\p{Variation_Selector}/gu, "");
  return /^.$/u.test(symbol) && (SENTENCE_ENDING_MARKS + additionalMarks).includes(symbol);
}
