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

/**
 * 正立で描く文字列を、半角形の字 1 つずつと残りの連なりに分ける
 *
 * WebKit は源暎こぶり明朝の半角形を、正立を指定しても vrt2 の横倒しの字形で半角分しか送らない
 * 組版は vmtx どおり全角 1 字分を割り当てる
 * 半角形を 1 字ずつ text-combine-upright で描くと、どのブラウザーでも立てたまま全角 1 字分を送る
 */
export function splitUprightHalfwidth(text: string): readonly UprightPart[] {
  const parts: UprightPart[] = [];
  let pendingStart = 0;
  let offset = 0;
  const flush = () => {
    if (offset > pendingStart)
      parts.push({ start: pendingStart, text: text.slice(pendingStart, offset), combined: false });
  };
  for (const character of text) {
    if (isHalfwidthForm(character.codePointAt(0) ?? 0)) {
      flush();
      parts.push({ start: offset, text: character, combined: true });
      pendingStart = offset + character.length;
    }
    offset += character.length;
  }
  flush();
  return parts;
}
