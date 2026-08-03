/**
 * Shared across parsing and proofreading so both agree on what counts as one grapheme.
 */
export const graphemeSegmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
