const LINE_GAP_H = 7;

export const A6_PAGE_FORMAT = {
  fontSizeQ: 12,
  flow: { lineLengthEm: 41, linesPerStage: 17, stagesPerPage: 1 },
  page: {
    lineGapMm: LINE_GAP_H / 4,
    stageGapMm: 0,
    topMm: 12.5,
    bottomMm: 12.5,
    innerMm: 16,
    outerMm: 10,
  },
} as const;
