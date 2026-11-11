/**
 * パースと校正で共有する。何を 1 書記素と数えるかを、両者で一致させるためである。
 */
export const graphemeSegmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
