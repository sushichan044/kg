/**
 * JLReq の cl-04（区切り約物）は全角を占める。
 * Unicode の East Asian Width が neutral である複合約物も含む。
 */
export const DIVIDING_PUNCTUATION = "！？‼⁇⁈⁉";

/**
 * 短い連なりを 1 つの縦中横のこまとして組む約物。`！？` は `⁉` として読む。
 */
export const TATE_CHU_YOKO_MARKS = "!?！？";

export const SENTENCE_ENDING_MARKS = `${DIVIDING_PUNCTUATION}♡♪☆`;
export const validAdditionalSentenceEndingMarks = (value: string): boolean =>
  /^[\p{S}]*$/u.test(value);

/**
 * 書記素 1 つ分の記号に一致する。テキスト用または絵文字用の字形選択子も許す。
 */
export function isSentenceEndingMark(grapheme: string, additionalMarks = ""): boolean {
  const symbol = grapheme.replace(/\p{Variation_Selector}/gu, "");
  return /^.$/u.test(symbol) && (SENTENCE_ENDING_MARKS + additionalMarks).includes(symbol);
}
