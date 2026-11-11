/**
 * 日本語の段落の先頭に置ける始め括弧類（引用符を含む）。半角形も含める。半角形を使った原稿でも、
 * 本文を書いているのではなく段落を始めているからである。
 */
export const OPENING_BRACKETS = "「『〖〈《（(“\"‘'［[〔｛{＜<";

/**
 * 対応する終わり括弧類。順序は同じ。
 */
export const CLOSING_BRACKETS = "」』〗〉》）)”\"’'］]〕｝}＞>";

/**
 * 正規表現の文字クラスが構文として読んでしまう文字をエスケープする。
 * 上で宣言した集合をパターンに埋め込めるようにするためである。
 */
export function characterClass(characters: string): string {
  return characters.replaceAll(/[\\\]^-]/gu, "\\$&");
}
