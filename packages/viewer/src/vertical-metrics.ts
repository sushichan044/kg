/**
 * `vhea` と `vmtx` から、グリフごとの縦の送り幅（フォント単位）を読む
 *
 * 表がないフォントでは `undefined` を返す
 */
export function readVerticalAdvances(
  vhea: Uint8Array | undefined,
  vmtx: Uint8Array | undefined,
): ((glyph: number) => number) | undefined {
  if (vhea === undefined || vmtx === undefined || vhea.byteLength < 36) return undefined;
  const header = new DataView(vhea.buffer, vhea.byteOffset, vhea.byteLength);
  const metrics = new DataView(vmtx.buffer, vmtx.byteOffset, vmtx.byteLength);
  const longMetrics = Math.min(header.getUint16(34), Math.floor(vmtx.byteLength / 4));
  if (longMetrics === 0) return undefined;
  // OpenType の仕様で、longVerMetric の数より後ろのグリフは最後の送り幅を共有する
  const last = metrics.getUint16((longMetrics - 1) * 4);
  return (glyph) => (glyph < longMetrics ? metrics.getUint16(glyph * 4) : last);
}
