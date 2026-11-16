export type ShapeDirection = "horizontal" | "vertical";

export type ShapeRequest = Readonly<{
  text: string;
  direction: ShapeDirection;
  weight: 400 | 700;
  features: Readonly<Record<string, number>>;
}>;

// リガチャは複数の書記素を 1 つにまとめるので、範囲は書記素より粗くなりうる
export type ShapedCluster = Readonly<{
  /**
   * `ShapeRequest.text` に対する UTF-16 オフセット（終端を含まない）
   */
  start: number;
  end: number;
  /**
   * 本文 1 em を 1 とした送り幅（倍率は掛けない）
   */
  advanceEm: number;
}>;

// DOM やブラウザーのフォント機構を使わず、フォントファイルだけから送り幅を引く
export type Shaper = Readonly<{
  hasGlyph: (codePoint: number, weight: 400 | 700) => boolean;
  /**
   * クラスターは先頭から隙間なく並び `text` 全体を覆う
   */
  shape: (request: ShapeRequest) => readonly ShapedCluster[];
}>;
