/**
 * A line of display text with the offset it starts at, so findings can be mapped back.
 */
export type DisplayLine = Readonly<{ text: string; start: number }>;

/**
 * Splits on CRLF, CR and LF. The text after the last break is always emitted, even when empty.
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
