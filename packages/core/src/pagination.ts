import * as v from "valibot";

import {
  DEFAULT_APPEARANCE,
  ManuscriptAppearanceSettingsSchema,
  ManuscriptGeometrySchema,
  calculateManuscriptGeometry,
} from "./appearance";
import { failure, mergeManuscriptRanges, success } from "./model";
import {
  ManuscriptDiagnosticSchema,
  ManuscriptProcessingErrorSchema,
  ManuscriptRangeSchema,
} from "./model";
import type { ManuscriptRange, ManuscriptResult } from "./model";
import { ManuscriptAnnotationSchema, ParsedManuscriptSchema } from "./notation";
import type { ManuscriptAnnotation, ParsedGrapheme, ParsedManuscript } from "./notation";

export const SETTING_RANGES = {
  charsPerLine: { min: 10, max: 60 },
  linesPerStage: { min: 10, max: 60 },
  stagesPerPage: { min: 1, max: 3 },
} as const;

const readonlyObject = <const TEntries extends v.ObjectEntries>(entries: TEntries) =>
  v.pipe(v.strictObject(entries), v.readonly());

const nonNegativeInteger = (maximum = Number.POSITIVE_INFINITY) =>
  v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0), v.maxValue(maximum));

export const GridSettingsSchema = readonlyObject({
  charsPerLine: v.pipe(
    v.number(),
    v.finite(),
    v.integer(),
    v.minValue(SETTING_RANGES.charsPerLine.min),
    v.maxValue(SETTING_RANGES.charsPerLine.max),
  ),
  linesPerStage: v.pipe(
    v.number(),
    v.finite(),
    v.integer(),
    v.minValue(SETTING_RANGES.linesPerStage.min),
    v.maxValue(SETTING_RANGES.linesPerStage.max),
  ),
  stagesPerPage: v.pipe(
    v.number(),
    v.finite(),
    v.integer(),
    v.minValue(SETTING_RANGES.stagesPerPage.min),
    v.maxValue(SETTING_RANGES.stagesPerPage.max),
  ),
});

export type GridSettings = v.InferOutput<typeof GridSettingsSchema>;

export const DEFAULT_SETTINGS = {
  charsPerLine: 27,
  linesPerStage: 23,
  stagesPerPage: 2,
} as const satisfies GridSettings;

export const LineOffsetSchema = readonlyObject({
  leading: nonNegativeInteger(),
  trailing: nonNegativeInteger(),
});

export type LineOffset = v.InferOutput<typeof LineOffsetSchema>;

export const MAX_DOCUMENT_OFFSET = 10_000;

export const ManuscriptOffsetsSchema = readonlyObject({
  document: readonlyObject({
    leading: nonNegativeInteger(MAX_DOCUMENT_OFFSET),
    trailing: nonNegativeInteger(MAX_DOCUMENT_OFFSET),
  }),
  page: LineOffsetSchema,
  stage: LineOffsetSchema,
});

export type ManuscriptOffsets = v.InferOutput<typeof ManuscriptOffsetsSchema>;

export const DEFAULT_OFFSETS: ManuscriptOffsets = {
  document: { leading: 0, trailing: 0 },
  page: { leading: 0, trailing: 0 },
  stage: { leading: 0, trailing: 0 },
};

export const ManuscriptCompositionSettingsSchema = v.pipe(
  readonlyObject({
    grid: GridSettingsSchema,
    offsets: ManuscriptOffsetsSchema,
    appearance: ManuscriptAppearanceSettingsSchema,
  }),
  v.check(
    ({ grid, offsets }) =>
      offsets.stage.leading + offsets.stage.trailing <= maxStageOffsetTotal(grid) &&
      offsets.page.leading + offsets.page.trailing <= maxPageOffsetTotal(grid, offsets.stage),
    "page or stage offsets leave no usable manuscript lines",
  ),
);

export type ManuscriptCompositionSettings = v.InferOutput<
  typeof ManuscriptCompositionSettingsSchema
>;

export const DEFAULT_COMPOSITION_SETTINGS: ManuscriptCompositionSettings = {
  grid: DEFAULT_SETTINGS,
  offsets: DEFAULT_OFFSETS,
  appearance: DEFAULT_APPEARANCE,
};

export const GridCellSchema = readonlyObject({
  value: v.nullable(v.string()),
  range: v.nullable(ManuscriptRangeSchema),
  annotations: v.pipe(v.array(ManuscriptAnnotationSchema), v.readonly()),
});
export type GridCell = v.InferOutput<typeof GridCellSchema>;

export const GridLineSchema = readonlyObject({
  range: v.nullable(ManuscriptRangeSchema),
  cells: v.pipe(v.array(GridCellSchema), v.readonly()),
});
export type GridLine = v.InferOutput<typeof GridLineSchema>;

export const GridStageSchema = readonlyObject({
  range: v.nullable(ManuscriptRangeSchema),
  lines: v.pipe(v.array(GridLineSchema), v.readonly()),
});
export type GridStage = v.InferOutput<typeof GridStageSchema>;

export const GridPageSchema = readonlyObject({
  range: v.nullable(ManuscriptRangeSchema),
  stages: v.pipe(v.array(GridStageSchema), v.readonly()),
});
export type GridPage = v.InferOutput<typeof GridPageSchema>;

export const CompositionStatisticsSchema = readonlyObject({
  chars: nonNegativeInteger(),
  sourceLines: nonNegativeInteger(),
  pages: nonNegativeInteger(),
});
export type CompositionStatistics = v.InferOutput<typeof CompositionStatisticsSchema>;

export const ManuscriptGridLayoutSchema = readonlyObject({
  pages: v.pipe(v.array(GridPageSchema), v.readonly()),
  geometry: ManuscriptGeometrySchema,
  stats: CompositionStatisticsSchema,
});
export type ManuscriptGridLayout = v.InferOutput<typeof ManuscriptGridLayoutSchema>;

export interface CompositionOutput<TSettings, TLayout> {
  readonly settings: TSettings;
  readonly layout: TLayout;
}

export interface ManuscriptComposer<TSettings, TLayout> {
  readonly id: string;
  readonly settingsSchema: v.GenericSchema<unknown, TSettings>;
  readonly layoutSchema: v.GenericSchema<unknown, TLayout>;
  compose(
    manuscript: ParsedManuscript,
    settings: TSettings,
  ): ManuscriptResult<CompositionOutput<TSettings, TLayout>>;
}

export interface ComposedManuscript<TSettings = unknown, TLayout = unknown> {
  readonly composerId: string;
  readonly parsed: ParsedManuscript;
  readonly settings: TSettings;
  readonly layout: TLayout;
}

export const GridComposedManuscriptSchema = readonlyObject({
  composerId: v.literal("kg/grid"),
  parsed: ParsedManuscriptSchema,
  settings: ManuscriptCompositionSettingsSchema,
  layout: ManuscriptGridLayoutSchema,
});

export type GridComposedManuscript = ComposedManuscript<
  ManuscriptCompositionSettings,
  ManuscriptGridLayout
>;

export interface ComposeManuscriptOptions<TSettings, TLayout> {
  readonly composer: ManuscriptComposer<TSettings, TLayout>;
  readonly settings: TSettings;
}

export function maxStageOffsetTotal(settings: GridSettings): number {
  return Math.max(0, settings.linesPerStage - 1);
}

export function maxPageOffsetTotal(settings: GridSettings, stageOffset: LineOffset): number {
  const usablePerStage = settings.linesPerStage - stageOffset.leading - stageOffset.trailing;
  return Math.max(0, usablePerStage * settings.stagesPerPage - 1);
}

export function validateCompositionSettings(
  settings: unknown,
): ManuscriptResult<ManuscriptCompositionSettings> {
  const result = v.safeParse(ManuscriptCompositionSettingsSchema, settings);
  if (!result.success) {
    return failure("compose", "invalid-settings", "invalid manuscript composition settings");
  }
  return success(result.output);
}

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

function annotationsFor(
  range: ManuscriptRange,
  annotations: readonly ManuscriptAnnotation[],
): readonly ManuscriptAnnotation[] {
  return annotations.filter(
    ({ range: annotation }) =>
      annotation.graphemes.start < range.graphemes.end &&
      annotation.graphemes.end > range.graphemes.start,
  );
}

function emptyCell(): GridCell {
  return { value: null, range: null, annotations: [] };
}

function line(cells: readonly GridCell[]): GridLine {
  return { cells, range: mergeManuscriptRanges(cells.map(({ range }) => range)) };
}

function padLine(cells: readonly GridCell[], charsPerLine: number): GridLine {
  const padded = [...cells];
  while (padded.length < charsPerLine) padded.push(emptyCell());
  return line(padded);
}

function blankLines(count: number, charsPerLine: number): GridLine[] {
  return Array.from({ length: count }, () => padLine([], charsPerLine));
}

function stage(lines: readonly GridLine[]): GridStage {
  return { lines, range: mergeManuscriptRanges(lines.map(({ range }) => range)) };
}

function page(stages: readonly GridStage[]): GridPage {
  return { stages, range: mergeManuscriptRanges(stages.map(({ range }) => range)) };
}

function buildPages(
  contentLines: readonly GridLine[],
  settings: ManuscriptCompositionSettings,
): GridPage[] {
  const { charsPerLine, linesPerStage, stagesPerPage } = settings.grid;
  const { stage: stageOffset, page: pageOffset } = settings.offsets;
  const usablePerStage = linesPerStage - stageOffset.leading - stageOffset.trailing;
  const totalUsablePerPage = usablePerStage * stagesPerPage;
  const pages: GridPage[] = [];
  let contentIndex = 0;

  while (contentIndex < contentLines.length || pages.length === 0) {
    const stages: GridStage[] = [];
    for (let stageIndex = 0; stageIndex < stagesPerPage; stageIndex += 1) {
      const lines: GridLine[] = [];
      for (let position = 0; position < linesPerStage; position += 1) {
        const inStage =
          position >= stageOffset.leading && position < linesPerStage - stageOffset.trailing;
        if (!inStage) {
          lines.push(padLine([], charsPerLine));
          continue;
        }
        const usableIndex = stageIndex * usablePerStage + position - stageOffset.leading;
        const inPage =
          usableIndex >= pageOffset.leading &&
          usableIndex < totalUsablePerPage - pageOffset.trailing;
        if (!inPage || contentIndex >= contentLines.length) {
          lines.push(padLine([], charsPerLine));
          continue;
        }
        lines.push(contentLines[contentIndex]!);
        contentIndex += 1;
      }
      stages.push(stage(lines));
    }
    pages.push(page(stages));
  }
  return pages;
}

function composeGrid(
  manuscript: ParsedManuscript,
  settings: ManuscriptCompositionSettings,
): ManuscriptResult<CompositionOutput<ManuscriptCompositionSettings, ManuscriptGridLayout>> {
  const validated = validateCompositionSettings(settings);
  if (!validated.ok) return validated;
  const normalized = validated.value;
  const manuscriptLines: GridLine[] = [];
  let chars = 0;
  const sourceLines = displayedLines(manuscript.graphemes);

  for (const sourceLine of sourceLines) {
    const occupied = sourceLine.map<GridCell>((grapheme) => ({
      value: grapheme.value,
      range: grapheme.range,
      annotations: annotationsFor(grapheme.range, manuscript.annotations),
    }));
    chars += occupied.length;
    if (occupied.length === 0) {
      manuscriptLines.push(padLine([], normalized.grid.charsPerLine));
      continue;
    }
    for (let index = 0; index < occupied.length; index += normalized.grid.charsPerLine) {
      manuscriptLines.push(
        padLine(
          occupied.slice(index, index + normalized.grid.charsPerLine),
          normalized.grid.charsPerLine,
        ),
      );
    }
  }

  const contentLines = [
    ...blankLines(normalized.offsets.document.leading, normalized.grid.charsPerLine),
    ...manuscriptLines,
    ...blankLines(normalized.offsets.document.trailing, normalized.grid.charsPerLine),
  ];
  const pages = buildPages(contentLines, normalized);
  return success({
    settings: normalized,
    layout: {
      pages,
      geometry: calculateManuscriptGeometry(normalized.grid, normalized.appearance),
      stats: { chars, sourceLines: sourceLines.length, pages: pages.length },
    },
  });
}

export const manuscriptGridComposer: ManuscriptComposer<
  ManuscriptCompositionSettings,
  ManuscriptGridLayout
> = {
  id: "kg/grid",
  settingsSchema: ManuscriptCompositionSettingsSchema,
  layoutSchema: ManuscriptGridLayoutSchema,
  compose: composeGrid,
};

export function composeManuscript<TSettings, TLayout>(
  parsed: ParsedManuscript,
  options: ComposeManuscriptOptions<TSettings, TLayout>,
): ManuscriptResult<ComposedManuscript<TSettings, TLayout>> {
  try {
    const parsedManuscript = v.safeParse(ParsedManuscriptSchema, parsed);
    if (!parsedManuscript.success) {
      return failure("compose", "invalid-manuscript", "invalid parsed manuscript");
    }
    const composerId = v.safeParse(
      v.pipe(v.string(), v.nonEmpty(), v.regex(/^[^/]+\/[^/]+$/u)),
      options.composer.id,
    );
    if (!composerId.success) {
      return failure("compose", "invalid-composer-id", "composer ID must use namespace/name");
    }
    const parsedSettings = v.safeParse(options.composer.settingsSchema, options.settings);
    if (!parsedSettings.success) {
      return failure("compose", "invalid-settings", "invalid composer settings");
    }
    const outputSchema = readonlyObject({
      settings: options.composer.settingsSchema,
      layout: options.composer.layoutSchema,
    });
    const resultSchema = v.variant("ok", [
      readonlyObject({
        ok: v.literal(true),
        value: outputSchema,
        warnings: v.pipe(v.array(ManuscriptDiagnosticSchema), v.readonly()),
      }),
      readonlyObject({
        ok: v.literal(false),
        errors: v.pipe(v.array(ManuscriptProcessingErrorSchema), v.readonly()),
      }),
    ]);
    const rawResult: unknown = options.composer.compose(
      parsedManuscript.output,
      parsedSettings.output,
    );
    const validatedResult = v.safeParse(resultSchema, rawResult);
    if (!validatedResult.success) {
      return failure("compose", "invalid-composer-output", "composer returned an invalid result");
    }
    const result = validatedResult.output;
    if (!result.ok) return result;
    return success(
      {
        composerId: composerId.output,
        parsed: parsedManuscript.output,
        settings: result.value.settings,
        layout: result.value.layout,
      },
      result.warnings,
    );
  } catch (error) {
    return failure(
      "compose",
      "composer-failed",
      error instanceof Error ? error.message : "composer failed",
    );
  }
}
