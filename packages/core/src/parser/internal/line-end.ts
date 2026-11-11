/**
 * `start` 以降で最初の改行文字を返す。CRLF は両方の文字とも行に含めない。
 */
export function lineEnd(source: string, start: number): number {
  const lf = source.indexOf("\n", start);
  const cr = source.indexOf("\r", start);
  if (lf === -1) return cr === -1 ? source.length : cr;
  if (cr === -1) return lf;
  return Math.min(lf, cr);
}
