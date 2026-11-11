/**
 * 表示用テキストの 1 行と、その行が始まるオフセット。指摘を元の位置へ対応づけられるようにする。
 */
export type DisplayLine = Readonly<{ text: string; start: number }>;

/**
 * CRLF、CR、LF で分割する。最後の改行の後のテキストは、空であっても必ず出力する。
 */
export function splitDisplayLines(text: string): DisplayLine[] {
  const lines: DisplayLine[] = [];
  let start = 0;
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character !== "\n" && character !== "\r") {
      index += 1;
      continue;
    }
    lines.push({ text: text.slice(start, index), start });
    index += character === "\r" && text[index + 1] === "\n" ? 2 : 1;
    start = index;
  }
  lines.push({ text: text.slice(start), start });
  return lines;
}
