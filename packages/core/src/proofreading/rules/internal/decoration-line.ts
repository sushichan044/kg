const DECORATION_LINE = /^[＊*◆◇■□●○▽▼△▲☆★・…―─━ー\-=＝~～\s]+$/u;

/**
 * 記号と空白だけでできた行。段落ではなく、場面転換や節の区切りである。
 * 字下げのルールはこれらを飛ばす。その配置が意図的だからである。
 */
export function isDecorationLine(text: string): boolean {
  return DECORATION_LINE.test(text);
}
