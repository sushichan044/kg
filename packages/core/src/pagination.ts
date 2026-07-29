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

export interface SourceRange {
  start: number;
  end: number;
}

export interface OccupiedCell {
  grapheme: string;
  sourceRange: SourceRange;
}

export type Cell = OccupiedCell | null;
export type Line = Cell[];
export type Stage = Line[];
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

interface SourceLine {
  text: string;
  start: number;
}

const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

function sourceLines(text: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let lineStart = 0;
  let index = 0;

  while (index < text.length) {
    const character = text[index];
    if (character !== "\n" && character !== "\r") {
      index += 1;

      continue;
    }

    lines.push({ text: text.slice(lineStart, index), start: lineStart });
    if (character === "\r" && text[index + 1] === "\n") {
      index += 2;
    } else {
      index += 1;
    }
    lineStart = index;
  }

  lines.push({ text: text.slice(lineStart), start: lineStart });
  if (
    lines.length > 1 &&
    lines.at(-1)?.text === "" &&
    (text.endsWith("\n") || text.endsWith("\r"))
  ) {
    lines.pop();
  }

  return lines.length === 0 ? [{ text: "", start: 0 }] : lines;
}

function cells(line: SourceLine): OccupiedCell[] {
  return Array.from(segmenter.segment(line.text), ({ index, segment }) => ({
    grapheme: segment,
    sourceRange: {
      start: line.start + index,
      end: line.start + index + segment.length,
    },
  }));
}

function padLine(items: Cell[], charsPerLine: number): Line {
  const line = items.slice();
  while (line.length < charsPerLine) {
    line.push(null);
  }

  return line;
}

function emptyStage(linesPerStage: number, charsPerLine: number): Stage {
  return Array.from({ length: linesPerStage }, () => padLine([], charsPerLine));
}

function chunkStages(lines: Line[], linesPerStage: number, charsPerLine: number): Stage[] {
  const stages: Stage[] = [];
  for (let index = 0; index < lines.length; index += linesPerStage) {
    const stage = lines.slice(index, index + linesPerStage);
    while (stage.length < linesPerStage) {
      stage.push(padLine([], charsPerLine));
    }
    stages.push(stage);
  }

  return stages;
}

function chunkPages(
  stages: Stage[],
  stagesPerPage: number,
  linesPerStage: number,
  charsPerLine: number,
): Page[] {
  const pages: Page[] = [];
  for (let index = 0; index < stages.length; index += stagesPerPage) {
    const page = stages.slice(index, index + stagesPerPage);
    while (page.length < stagesPerPage) {
      page.push(emptyStage(linesPerStage, charsPerLine));
    }
    pages.push(page);
  }

  return pages;
}

export function paginateManuscript(text: string, settings: GridSettings): Pagination {
  const { charsPerLine, linesPerStage, stagesPerPage } = settings;
  const lines = sourceLines(text);
  const manuscriptLines: Line[] = [];
  let chars = 0;

  for (const sourceLine of lines) {
    const occupied = cells(sourceLine);
    chars += occupied.length;
    if (occupied.length === 0) {
      manuscriptLines.push(padLine([], charsPerLine));

      continue;
    }
    for (let index = 0; index < occupied.length; index += charsPerLine) {
      manuscriptLines.push(padLine(occupied.slice(index, index + charsPerLine), charsPerLine));
    }
  }

  const stages = chunkStages(manuscriptLines, linesPerStage, charsPerLine);
  const pages = chunkPages(stages, stagesPerPage, linesPerStage, charsPerLine);

  return {
    pages,
    stats: { chars, sourceLines: lines.length, pages: pages.length },
  };
}

export const paginate = paginateManuscript;
