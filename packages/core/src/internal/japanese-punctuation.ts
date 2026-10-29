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
