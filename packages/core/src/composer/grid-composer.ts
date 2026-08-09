import { NamespacedId } from "../namespaced-id";
import { ManuscriptAnnotation } from "../parser/annotation/manuscript-annotation";
import type { ParsedGrapheme } from "../parser/parsed-grapheme";
import type { ParsedManuscript } from "../parser/parsed-manuscript";
import { ManuscriptResult } from "../result/manuscript-result";
import type { ComposedManuscript } from "./composed-manuscript";
import { ManuscriptCompositionSettings } from "./composition-settings";
import type { GridCell } from "./grid-cell";
import { GridLine } from "./grid-line";
import { GridPage } from "./grid-page";
import { GridStage } from "./grid-stage";
import { resolveLineBreak } from "./internal/kinsoku";
import type { KinsokuSettings } from "./kinsoku-settings";
import { LineOffset } from "./line-offset";
import type { ManuscriptComposer } from "./manuscript-composer";
import { ManuscriptGeometry } from "./manuscript-geometry";
import { ManuscriptGridLayout } from "./manuscript-grid-layout";

const COMPOSER_ID = NamespacedId.of("kg/grid");

export type GridComposedManuscript = ComposedManuscript<
  ManuscriptCompositionSettings,
  ManuscriptGridLayout
>;

/**
 * Splits display graphemes on line breaks. A trailing break does not create an empty last line.
 */
function displayedLines(graphemes: readonly ParsedGrapheme[]): ParsedGrapheme[][] {
  const lines: ParsedGrapheme[][] = [[]];
  let endedWithLineBreak = false;
  for (const grapheme of graphemes) {
    if (grapheme.value === "\n" || grapheme.value === "\r" || grapheme.value === "\r\n") {
      lines.push([]);
      endedWithLineBreak = true;
      continue;
    }
    lines.at(-1)!.push(grapheme);
    endedWithLineBreak = false;
  }
  if (lines.length > 1 && endedWithLineBreak) lines.pop();
  return lines;
}

function toCells(
  sourceLine: readonly ParsedGrapheme[],
  annotations: readonly ManuscriptAnnotation[],
): GridCell[] {
  return sourceLine.map((grapheme) => ({
    value: grapheme.value,
    range: grapheme.range,
    annotations: ManuscriptAnnotation.overlapping(annotations, grapheme.range),
  }));
}

/**
 * Wraps one source line across as many grid lines as its length requires. A fixed grid cannot
 * tighten a line to make room, so kinsoku only ever pushes a wrap boundary earlier — never later
 * than the plain charsPerLine slice — either by hanging trailing punctuation off the line or by
 * carrying one or more characters to the next line instead.
 */
function wrapLine(
  cells: readonly GridCell[],
  charsPerLine: number,
  kinsoku: KinsokuSettings,
): GridLine[] {
  if (cells.length === 0) return [GridLine.padded([], charsPerLine)];

  const lines: GridLine[] = [];
  let index = 0;
  while (index < cells.length) {
    const tentativeEnd = Math.min(index + charsPerLine, cells.length);
    // The manuscript's own line end is not a wrap boundary, so kinsoku never applies to it.
    if (!kinsoku.enabled || tentativeEnd === cells.length) {
      lines.push(GridLine.padded(cells.slice(index, tentativeEnd), charsPerLine));
      index = tentativeEnd;
      continue;
    }

    const { end, hanging } = resolveLineBreak(cells, index, tentativeEnd, kinsoku);
    lines.push(GridLine.padded(cells.slice(index, end), charsPerLine, hanging));
    index = end + hanging.length;
  }
  return lines;
}

function blankLines(count: number, charsPerLine: number): GridLine[] {
  return Array.from({ length: count }, () => GridLine.padded([], charsPerLine));
}

/**
 * Walks every line position on every page in reading order, handing out content lines only where
 * the stage and page offsets leave room. Always emits at least one page.
 */
function buildPages(
  contentLines: readonly GridLine[],
  settings: ManuscriptCompositionSettings,
): GridPage[] {
  const { charsPerLine, linesPerStage, stagesPerPage } = settings.grid;
  const { stage: stageOffset, page: pageOffset } = settings.offsets;
  const usablePerStage = linesPerStage - LineOffset.total(stageOffset);
  const usablePerPage = usablePerStage * stagesPerPage;
  const pages: GridPage[] = [];
  let contentIndex = 0;

  while (contentIndex < contentLines.length || pages.length === 0) {
    const stages: GridStage[] = [];
    for (let stageIndex = 0; stageIndex < stagesPerPage; stageIndex += 1) {
      const lines: GridLine[] = [];
      for (let position = 0; position < linesPerStage; position += 1) {
        const usableIndex = stageIndex * usablePerStage + position - stageOffset.leading;
        const withinStage =
          position >= stageOffset.leading && position < linesPerStage - stageOffset.trailing;
        const withinPage =
          usableIndex >= pageOffset.leading && usableIndex < usablePerPage - pageOffset.trailing;
        const next = contentLines[contentIndex];

        if (!withinStage || !withinPage || next === undefined) {
          lines.push(GridLine.padded([], charsPerLine));
          continue;
        }
        lines.push(next);
        contentIndex += 1;
      }
      stages.push(GridStage.of(lines));
    }
    pages.push(GridPage.of(stages));
  }
  return pages;
}

function composeGrid(
  manuscript: ParsedManuscript,
  settings: ManuscriptCompositionSettings,
): ManuscriptResult<ManuscriptGridLayout, never> {
  const { charsPerLine } = settings.grid;
  const sourceLines = displayedLines(manuscript.graphemes);
  const cellLines = sourceLines.map((line) => toCells(line, manuscript.annotations));
  const manuscriptLines = cellLines.flatMap((cells) =>
    wrapLine(cells, charsPerLine, settings.kinsoku),
  );

  const pages = buildPages(
    [
      ...blankLines(settings.offsets.document.leading, charsPerLine),
      ...manuscriptLines,
      ...blankLines(settings.offsets.document.trailing, charsPerLine),
    ],
    settings,
  );

  return ManuscriptResult.succeed({
    pages,
    geometry: ManuscriptGeometry.of(settings.grid, settings.appearance),
    stats: {
      chars: cellLines.reduce((total, cells) => total + cells.length, 0),
      sourceLines: sourceLines.length,
      pages: pages.length,
    },
  });
}

/**
 * Places text on Japanese manuscript paper: vertical lines grouped into stages, stages into pages.
 * Settings arrive already validated by {@link composeManuscript}, so this never rejects.
 */
export const manuscriptGridComposer: ManuscriptComposer<
  ManuscriptCompositionSettings,
  ManuscriptGridLayout
> = {
  id: COMPOSER_ID,
  settingsSchema: ManuscriptCompositionSettings.schema,
  layoutSchema: ManuscriptGridLayout.schema,
  compose: composeGrid,
};
