/**
 * Returns the first line terminator at or after start. Both halves of CRLF remain outside the line.
 */
export function lineEnd(source: string, start: number): number {
  const lf = source.indexOf("\n", start);
  const cr = source.indexOf("\r", start);
  if (lf === -1) return cr === -1 ? source.length : cr;
  if (cr === -1) return lf;
  return Math.min(lf, cr);
}
