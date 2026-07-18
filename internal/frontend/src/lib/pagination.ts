// Pagination lays source text onto the manuscript grid following the rules in
// docs/design.md. It intentionally omits Japanese line-breaking corrections
// (kinsoku, tate-chu-yoko, ruby): one grapheme cluster always fills one cell.

export interface GridSettings {
  charsPerLine: number;
  linesPerStage: number;
  stagesPerPage: number;
}

export const DEFAULT_SETTINGS: GridSettings = {
  charsPerLine: 27,
  linesPerStage: 23,
  stagesPerPage: 2,
};

export const SETTING_RANGES = {
  charsPerLine: { min: 10, max: 60 },
  linesPerStage: { min: 10, max: 60 },
  stagesPerPage: { min: 1, max: 3 },
} as const;

// A cell holds one grapheme cluster, or null when empty.
export type Cell = string | null;
// A line is a vertical column of exactly charsPerLine cells.
export type Line = Cell[];
// A stage is exactly linesPerStage lines.
export type Stage = Line[];
// A page is exactly stagesPerPage stages.
export type Page = Stage[];

export interface Statistics {
  chars: number;
  sourceLines: number;
  pages: number;
}

export interface Pagination {
  pages: Page[];
  stats: Statistics;
}

const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

function graphemes(line: string): string[] {
  return Array.from(segmenter.segment(line), (s) => s.segment);
}

// normalize applies rules 1 and 2: CRLF/CR become LF, then one terminal LF is
// removed so a conventional trailing newline does not add a blank line.
function normalize(text: string): string {
  const lf = text.replace(/\r\n?/g, "\n");

  return lf.endsWith("\n") ? lf.slice(0, -1) : lf;
}

function padLine(cells: Cell[], charsPerLine: number): Line {
  const line = cells.slice();
  while (line.length < charsPerLine) {
    line.push(null);
  }

  return line;
}

function emptyStage(linesPerStage: number, charsPerLine: number): Stage {
  return Array.from({ length: linesPerStage }, () => padLine([], charsPerLine));
}

// chunkStages groups manuscript lines into stages, padding the final stage with
// empty lines so every stage draws a complete grid.
function chunkStages(lines: Line[], linesPerStage: number, charsPerLine: number): Stage[] {
  const stages: Stage[] = [];
  for (let i = 0; i < lines.length; i += linesPerStage) {
    const stage = lines.slice(i, i + linesPerStage);
    while (stage.length < linesPerStage) {
      stage.push(padLine([], charsPerLine));
    }
    stages.push(stage);
  }

  return stages;
}

// chunkPages groups stages into pages, padding the final page with empty stages.
function chunkPages(
  stages: Stage[],
  stagesPerPage: number,
  linesPerStage: number,
  charsPerLine: number,
): Page[] {
  const pages: Page[] = [];
  for (let i = 0; i < stages.length; i += stagesPerPage) {
    const page = stages.slice(i, i + stagesPerPage);
    while (page.length < stagesPerPage) {
      page.push(emptyStage(linesPerStage, charsPerLine));
    }
    pages.push(page);
  }

  return pages;
}

export function paginate(text: string, settings: GridSettings): Pagination {
  const { charsPerLine, linesPerStage, stagesPerPage } = settings;
  const sourceLines = normalize(text).split("\n");

  let chars = 0;
  const manuscriptLines: Line[] = [];
  for (const sourceLine of sourceLines) {
    const clusters = graphemes(sourceLine);
    chars += clusters.length;

    // An empty source line is preserved as one empty manuscript line.
    if (clusters.length === 0) {
      manuscriptLines.push(padLine([], charsPerLine));

      continue;
    }

    // A source line starts a new manuscript line and wraps after charsPerLine.
    for (let i = 0; i < clusters.length; i += charsPerLine) {
      manuscriptLines.push(padLine(clusters.slice(i, i + charsPerLine), charsPerLine));
    }
  }

  const stages = chunkStages(manuscriptLines, linesPerStage, charsPerLine);
  const pages = chunkPages(stages, stagesPerPage, linesPerStage, charsPerLine);

  return {
    pages,
    stats: { chars, sourceLines: sourceLines.length, pages: pages.length },
  };
}
