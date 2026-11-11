import type { RasterImage } from "./png";

/**
 * Worker が公開する API。main 側の `exportPages` と Worker 側の `definePageEncoderWorker` が共有する。
 * Worker 側の実装（fflate）を main に引き込まないよう、型だけをここに置く。
 */
export type PageEncoderApi = {
  /**
   * 1 ページ分のピクセルを PNG のバイト列にする。
   */
  encodePage: (image: RasterImage) => Uint8Array;
  /**
   * ファイル名とバイト列の組を、無圧縮の zip にまとめる。
   */
  zip: (files: Readonly<Record<string, Uint8Array>>) => Uint8Array;
};
