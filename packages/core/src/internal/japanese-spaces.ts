const LEADING_SPACES = /^[　 \t]+/u;

/**
 * 日本語の原稿が字下げに使う唯一の空白であり、！や？の後に許される唯一のアキでもある。
 */
export const IDEOGRAPHIC_SPACE = "　";

/**
 * テキストの先頭にある空白の連なり。なければ空文字列。半角空白とタブも含める。
 * ルールがそれらを見つけられなければ、誤った空白だと指摘できないからである。
 */
export function leadingSpaces(text: string): string {
  return LEADING_SPACES.exec(text)?.[0] ?? "";
}
