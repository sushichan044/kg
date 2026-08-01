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

/**
 * Blank lines reserved (or added) at the start/end of a scope, counted in lines.
 */
export interface LineOffset {
  leading: number;
  trailing: number;
}

/**
 * Line-offset reservations at three independent scopes: - `document`: blank lines
 * prepended/appended to the manuscript's content itself. - `page`: blank lines reserved at the
 * start/end of every page. - `stage`: blank lines reserved at the start/end of every stage.
 */
export interface ManuscriptOffsets {
  document: LineOffset;
  page: LineOffset;
  stage: LineOffset;
}

export const DEFAULT_OFFSETS: ManuscriptOffsets = {
  document: { leading: 0, trailing: 0 },
  page: { leading: 0, trailing: 0 },
  stage: { leading: 0, trailing: 0 },
};

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

function blankLines(count: number, charsPerLine: number): Line[] {
  return Array.from({ length: count }, () => padLine([], charsPerLine));
}

function nonNegativeInt(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Hard upper bound for a single document-level leading/trailing offset. Unlike stage/page offsets
 * (bounded by `maxStageOffsetTotal`/`maxPageOffsetTotal` so at least one content line per
 * stage/page remains), the document offset has no such natural ceiling and is folded directly into
 * `blankLines(count, ...)`. This is a manuscript-preview tool, not a print pipeline, so a
 * leading/trailing reservation in the thousands of lines has no legitimate use case; capping it
 * here keeps `Array.from({ length: count }, ...)` cheap and finite regardless of caller input (e.g.
 * a huge value written directly to localStorage).
 */
export const MAX_DOCUMENT_OFFSET = 10_000;

function clampNonNegativeInt(value: number, max: number): number {
  return Math.min(nonNegativeInt(value), max);
}

function clampOffsetTotal(offset: LineOffset, maxTotal: number): LineOffset {
  const leading = nonNegativeInt(offset.leading);
  const trailing = nonNegativeInt(offset.trailing);
  if (leading + trailing <= maxTotal) {
    return { leading, trailing };
  }
  const clampedLeading = Math.min(leading, maxTotal);

  return { leading: clampedLeading, trailing: Math.max(0, maxTotal - clampedLeading) };
}

/**
 * The largest stage leading+trailing total that still leaves at least one usable line per stage.
 */
export function maxStageOffsetTotal(settings: GridSettings): number {
  return Math.max(0, settings.linesPerStage - 1);
}

/**
 * The largest page leading+trailing total that still leaves at least one usable line per page,
 * given a (already clamped) stage offset.
 */
export function maxPageOffsetTotal(settings: GridSettings, stageOffset: LineOffset): number {
  const resolvedStage = clampOffsetTotal(stageOffset, maxStageOffsetTotal(settings));
  const usablePerStage = settings.linesPerStage - resolvedStage.leading - resolvedStage.trailing;

  return Math.max(0, usablePerStage * settings.stagesPerPage - 1);
}

/**
 * Clamps offsets so every page keeps at least one available content line, preventing an infinite
 * loop when reserved lines would otherwise consume every slot. `paginateManuscript` only ever uses
 * the resolved values.
 */
export function resolveOffsets(
  settings: GridSettings,
  offsets: ManuscriptOffsets,
): ManuscriptOffsets {
  const stage = clampOffsetTotal(offsets.stage, maxStageOffsetTotal(settings));
  const page = clampOffsetTotal(offsets.page, maxPageOffsetTotal(settings, stage));
  const document = {
    leading: clampNonNegativeInt(offsets.document.leading, MAX_DOCUMENT_OFFSET),
    trailing: clampNonNegativeInt(offsets.document.trailing, MAX_DOCUMENT_OFFSET),
  };

  return { document, page, stage };
}

/**
 * Builds pages by filling one page's slots at a time from `contentLines`, reserving blank lines at
 * each stage's and page's leading/trailing edges. The document-level offset is not a reservation:
 * it is folded into `contentLines` itself before this function runs, so it flows through whatever
 * slots remain exactly like ordinary content.
 */
function buildPages(
  contentLines: Line[],
  settings: GridSettings,
  resolvedOffsets: ManuscriptOffsets,
): Page[] {
  const { charsPerLine, linesPerStage, stagesPerPage } = settings;
  const { stage: stageOffset, page: pageOffset } = resolvedOffsets;
  const usablePerStage = linesPerStage - stageOffset.leading - stageOffset.trailing;
  const totalUsablePerPage = usablePerStage * stagesPerPage;

  const pages: Page[] = [];
  let contentIndex = 0;

  while (contentIndex < contentLines.length || pages.length === 0) {
    const stages: Stage[] = [];
    for (let stageIndex = 0; stageIndex < stagesPerPage; stageIndex += 1) {
      const lines: Line[] = [];
      for (let pos = 0; pos < linesPerStage; pos += 1) {
        const inStageBody =
          pos >= stageOffset.leading && pos < linesPerStage - stageOffset.trailing;
        if (!inStageBody) {
          lines.push(padLine([], charsPerLine));

          continue;
        }
        const usableIndex = stageIndex * usablePerStage + (pos - stageOffset.leading);
        const inPageBody =
          usableIndex >= pageOffset.leading &&
          usableIndex < totalUsablePerPage - pageOffset.trailing;
        if (!inPageBody || contentIndex >= contentLines.length) {
          lines.push(padLine([], charsPerLine));

          continue;
        }
        lines.push(contentLines[contentIndex]!);
        contentIndex += 1;
      }
      stages.push(lines);
    }
    pages.push(stages);
  }

  return pages;
}

export function paginateManuscript(
  text: string,
  settings: GridSettings,
  offsets: ManuscriptOffsets = DEFAULT_OFFSETS,
): Pagination {
  const { charsPerLine } = settings;
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

  const resolvedOffsets = resolveOffsets(settings, offsets);
  const contentLines: Line[] = [
    ...blankLines(resolvedOffsets.document.leading, charsPerLine),
    ...manuscriptLines,
    ...blankLines(resolvedOffsets.document.trailing, charsPerLine),
  ];
  const pages = buildPages(contentLines, settings, resolvedOffsets);

  return {
    pages,
    stats: { chars, sourceLines: lines.length, pages: pages.length },
  };
}

export const paginate = paginateManuscript;
