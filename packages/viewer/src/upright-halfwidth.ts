type UprightPart = Readonly<{
  // text に対する UTF-16 オフセット
  start: number;
  text: string;
  combined: boolean;
}>;

// Halfwidth and Fullwidth Forms ブロックのうち East_Asian_Width が H の範囲
function isHalfwidthForm(codePoint: number): boolean {
  return (
    (codePoint >= 0xff61 && codePoint <= 0xffdc) || (codePoint >= 0xffe8 && codePoint <= 0xffee)
  );
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * 正立で描く文字列を、半角形で始まる書記素 1 つずつと残りの連なりに分ける
 *
 * WebKit は源暎こぶり明朝の半角形を、正立を指定しても vrt2 の横倒しの字形で半角分しか送らない
 * 組版は半角形の書記素に全角 1 字分を割り当てる
 * 半角形を書記素ごとに横組みの全角の箱に入れると、どのブラウザーでも立てたまま全角 1 字分を送る
 * 濁点と半濁点（Grapheme_Extend）は直前の字と同じ書記素なので、同じ箱の中で右上に付く
 */
export function splitUprightHalfwidth(text: string): readonly UprightPart[] {
  const parts: UprightPart[] = [];
  let pendingStart = 0;
  const flush = (end: number) => {
    if (end > pendingStart)
      parts.push({ start: pendingStart, text: text.slice(pendingStart, end), combined: false });
  };
  for (const { segment, index } of graphemeSegmenter.segment(text)) {
    if (!isHalfwidthForm(segment.codePointAt(0) ?? 0)) continue;
    flush(index);
    parts.push({ start: index, text: segment, combined: true });
    pendingStart = index + segment.length;
  }
  flush(text.length);
  return parts;
}
