import { CLOSING_BRACKETS, OPENING_BRACKETS } from "../internal/japanese-brackets";
import { questionOrExclamationSpacings } from "../internal/question-or-exclamation-spacing";
import { graphemeSegmenter } from "../internal/segmenter";
import { NamespacedId } from "../namespaced-id";
import type { ManuscriptAnnotation } from "../parser/annotation/manuscript-annotation";
import type { RubyAnnotation, RubyReading } from "../parser/annotation/ruby-annotation";
import type { ParsedGrapheme } from "../parser/parsed-grapheme";
import type { ParsedManuscript } from "../parser/parsed-manuscript";
import { ManuscriptRange } from "../range/manuscript-range";
import { ManuscriptResult } from "../result/manuscript-result";
import type { ComposedAnnotationFragment } from "./composed-annotation-fragment";
import type { ComposedManuscript } from "./composed-manuscript";
import { NovelCompositionSettings } from "./composition-settings";
import type { InlineMeasurer } from "./inline-measurer";
import { logicalInlineMeasurer } from "./inline-measurer";
import { LineOffset } from "./line-offset";
import type { ManuscriptComposer } from "./manuscript-composer";
import { ManuscriptGeometry } from "./manuscript-geometry";
import type { NovelLayout } from "./novel-layout";
import { NovelLayout as NovelLayoutContract } from "./novel-layout";
import type { NovelLine } from "./novel-line";
import { NovelLine as NovelLineContract } from "./novel-line";
import { NovelPage } from "./novel-page";
import { NovelStage } from "./novel-stage";
import type { PositionedGrapheme, SuppressedGrapheme } from "./positioned-grapheme";

const COMPOSER_ID = NamespacedId.of("kg/novel");

const LINE_START_PROHIBITED = new Set(
  `、。，．・：；？！‼⁇⁈⁉ヽヾゝゞ々ーァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎゕゖ${CLOSING_BRACKETS}】〙〟｠»`,
);
const LINE_END_PROHIBITED = new Set(`${OPENING_BRACKETS}【〘〝｟«`);
const HANGING_PUNCTUATION = new Set("、。，．！？");
const INSEPARABLE_PAIRS = new Set(["……", "――", "──", "〳〵"]);

type Atom = Readonly<{ grapheme: ParsedGrapheme; advanceEm: number }>;

type MeasuredSourceLine = Readonly<{
  atoms: readonly Atom[];
  suppressedIndexes: ReadonlySet<number>;
}>;

export type NovelComposedManuscript = ComposedManuscript<NovelCompositionSettings, NovelLayout>;

function displayedLines(graphemes: readonly ParsedGrapheme[]): ParsedGrapheme[][] {
  const lines: ParsedGrapheme[][] = [[]];
  let endedWithLineBreak = false;

  for (const grapheme of graphemes) {
    if (grapheme.value === "\n" || grapheme.value === "\r" || grapheme.value === "\r\n") {
      lines.push([]);
      endedWithLineBreak = true;
      continue;
    }
    lines.at(-1)?.push(grapheme);
    endedWithLineBreak = false;
  }

  if (lines.length > 1 && endedWithLineBreak) lines.pop();
  return lines;
}

function validGapIndexes(sourceLine: readonly ParsedGrapheme[]): ReadonlySet<number> {
  const line = sourceLine.map(({ value }) => value).join("");
  const gapStarts = new Set(
    questionOrExclamationSpacings(line)
      .filter((spacing) => spacing.kind === "valid")
      .map(({ gap }) => gap.start),
  );
  const indexes = new Set<number>();
  let offset = 0;

  for (const [index, grapheme] of sourceLine.entries()) {
    if (gapStarts.has(offset)) indexes.add(index);
    offset += grapheme.value.length;
  }

  return indexes;
}

function indicesInside(atoms: readonly Atom[], annotation: RubyAnnotation): number[] {
  return atoms.flatMap(({ grapheme }, index) =>
    ManuscriptRange.overlaps(grapheme.range, annotation.range) ? [index] : [],
  );
}

function measure(
  measurer: InlineMeasurer,
  text: string,
  role: "base" | "ruby",
  settings: NovelCompositionSettings,
): number | undefined {
  const value = measurer({
    text,
    role,
    fontPreset: settings.appearance.fontPreset,
    writingMode: "vertical-rl",
  });

  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function measureSourceLine(
  sourceLine: readonly ParsedGrapheme[],
  annotations: readonly ManuscriptAnnotation[],
  settings: NovelCompositionSettings,
  measurer: InlineMeasurer,
): MeasuredSourceLine | undefined {
  const mutable = sourceLine.map((grapheme) => {
    const advanceEm = measure(measurer, grapheme.value, "base", settings);
    return advanceEm === undefined ? undefined : { grapheme, advanceEm };
  });
  if (mutable.some((atom) => atom === undefined)) return undefined;

  const atoms: Array<{ grapheme: ParsedGrapheme; advanceEm: number }> = mutable.flatMap((atom) =>
    atom === undefined ? [] : [atom],
  );

  for (const annotation of annotations) {
    if (annotation.kind !== "ruby") continue;
    const indexes = indicesInside(atoms, annotation);
    if (indexes.length === 0) continue;
    const readingTexts =
      annotation.reading.kind === "group" ? [annotation.reading.text] : annotation.reading.segments;
    const hasInvalidReadingGrapheme = readingTexts.some((text) =>
      [...graphemeSegmenter.segment(text)].some(
        ({ segment }) => measure(measurer, segment, "ruby", settings) === undefined,
      ),
    );
    if (hasInvalidReadingGrapheme) return undefined;

    if (annotation.reading.kind === "group") {
      const readingAdvance = measure(measurer, annotation.reading.text, "ruby", settings);
      if (readingAdvance === undefined) return undefined;
      const baseAdvance = indexes.reduce(
        (total, index) => total + (atoms[index]?.advanceEm ?? 0),
        0,
      );
      const extra = Math.max(0, readingAdvance - baseAdvance) / indexes.length;
      for (const index of indexes) {
        const atom = atoms[index];
        if (atom !== undefined) atom.advanceEm += extra;
      }
      continue;
    }

    for (const [segmentIndex, index] of indexes.entries()) {
      const segment = annotation.reading.segments[segmentIndex];
      const atom = atoms[index];
      if (segment === undefined || atom === undefined) continue;
      const readingAdvance = measure(measurer, segment, "ruby", settings);
      if (readingAdvance === undefined) return undefined;
      atom.advanceEm = Math.max(atom.advanceEm, readingAdvance);
    }
  }

  return { atoms, suppressedIndexes: validGapIndexes(sourceLine) };
}

function breakInsideFittableGroupRuby(
  atoms: readonly Atom[],
  annotations: readonly ManuscriptAnnotation[],
  boundary: number,
  lineLengthEm: number,
): boolean {
  const right = atoms[boundary];
  if (right === undefined) return false;
  const graphemeIndex = right.grapheme.range.graphemes.start;

  return annotations.some((annotation) => {
    if (annotation.kind !== "ruby" || annotation.reading.kind !== "group") return false;
    if (
      graphemeIndex <= annotation.range.graphemes.start ||
      graphemeIndex >= annotation.range.graphemes.end
    ) {
      return false;
    }
    const indexes = indicesInside(atoms, annotation);
    const advance = indexes.reduce((total, index) => total + (atoms[index]?.advanceEm ?? 0), 0);
    return advance <= lineLengthEm;
  });
}

function legalBoundary(
  atoms: readonly Atom[],
  annotations: readonly ManuscriptAnnotation[],
  boundary: number,
  lineLengthEm: number,
): boolean {
  const left = atoms[boundary - 1];
  const right = atoms[boundary];
  if (left === undefined || right === undefined) return true;

  return (
    !LINE_END_PROHIBITED.has(left.grapheme.value) &&
    !LINE_START_PROHIBITED.has(right.grapheme.value) &&
    !INSEPARABLE_PAIRS.has(left.grapheme.value + right.grapheme.value) &&
    !breakInsideFittableGroupRuby(atoms, annotations, boundary, lineLengthEm)
  );
}

function continuationFor(annotation: ManuscriptAnnotation, range: ManuscriptRange) {
  const starts = range.graphemes.start === annotation.range.graphemes.start;
  const ends = range.graphemes.end === annotation.range.graphemes.end;
  if (starts && ends) return "whole" as const;
  if (starts) return "start" as const;
  if (ends) return "end" as const;
  return "middle" as const;
}

function readingForFragment(
  annotation: RubyAnnotation,
  range: ManuscriptRange,
  baseAdvances: ReadonlyMap<number, number>,
): Readonly<{ kind: RubyReading["kind"]; text: string }> {
  const start = range.graphemes.start - annotation.range.graphemes.start;
  const length = range.graphemes.end - range.graphemes.start;
  const baseLength = annotation.range.graphemes.end - annotation.range.graphemes.start;

  if (annotation.reading.kind !== "group") {
    return {
      kind: annotation.reading.kind,
      text: annotation.reading.segments.slice(start, start + length).join(""),
    };
  }

  const reading = [...graphemeSegmenter.segment(annotation.reading.text)].map(
    ({ segment }) => segment,
  );
  const advances = Array.from({ length: baseLength }, (_, index) =>
    baseAdvances.get(annotation.range.graphemes.start + index),
  );
  const measured = advances.every((advance) => advance !== undefined);
  const totalAdvance = measured
    ? advances.reduce((total, advance) => total + advance, 0)
    : baseLength;
  const advanceBefore = measured
    ? advances.slice(0, start).reduce((total, advance) => total + advance, 0)
    : start;
  const fragmentAdvance = measured
    ? advances.slice(start, start + length).reduce((total, advance) => total + advance, 0)
    : length;
  const denominator = totalAdvance > 0 ? totalAdvance : baseLength;
  const readingStart = Math.round((advanceBefore * reading.length) / denominator);
  const readingEnd = Math.round(((advanceBefore + fragmentAdvance) * reading.length) / denominator);
  return { kind: "group", text: reading.slice(readingStart, readingEnd).join("") };
}

function positionReading(
  text: string,
  baseOffsetEm: number,
  baseAdvanceEm: number,
  settings: NovelCompositionSettings,
  measurer: InlineMeasurer,
) {
  const measured = [...graphemeSegmenter.segment(text)].map(({ segment }) => ({
    value: segment,
    advanceEm: measure(measurer, segment, "ruby", settings) ?? 0,
  }));
  const total = measured.reduce((sum, grapheme) => sum + grapheme.advanceEm, 0);
  const edgeGap =
    measured.length > 0 && total < baseAdvanceEm
      ? (baseAdvanceEm - total) / (2 * measured.length)
      : 0;
  let offsetEm = baseOffsetEm + (total > baseAdvanceEm ? (baseAdvanceEm - total) / 2 : edgeGap);

  return measured.map((grapheme, index) => {
    const positioned = {
      value: grapheme.value,
      advanceEm: grapheme.advanceEm,
      offsetEm,
    };
    offsetEm += grapheme.advanceEm;
    if (index < measured.length - 1) offsetEm += edgeGap * 2;
    return positioned;
  });
}

function annotationFragments(
  graphemes: readonly PositionedGrapheme[],
  annotations: readonly ManuscriptAnnotation[],
  settings: NovelCompositionSettings,
  measurer: InlineMeasurer,
  baseAdvances: ReadonlyMap<number, number>,
): ComposedAnnotationFragment[] {
  const fragments: ComposedAnnotationFragment[] = [];

  for (const annotation of annotations) {
    const covered = graphemes.filter(({ range }) =>
      ManuscriptRange.overlaps(range, annotation.range),
    );
    const fragmentRange = ManuscriptRange.merge(covered.map(({ range }) => range));
    const first = covered[0];
    const last = covered.at(-1);
    if (fragmentRange === null || first === undefined || last === undefined) continue;

    const common = {
      annotationRange: annotation.range,
      fragmentRange,
      continuation: continuationFor(annotation, fragmentRange),
    } as const;

    switch (annotation.kind) {
      case "bold":
      case "italic": {
        fragments.push({ kind: annotation.kind, ...common });
        break;
      }
      case "emphasis": {
        fragments.push({ kind: "emphasis", mark: annotation.mark, ...common });
        break;
      }
      case "ruby": {
        const baseOffsetEm = first.offsetEm;
        const baseAdvanceEm = last.offsetEm + last.advanceEm - baseOffsetEm;
        const reading = readingForFragment(annotation, fragmentRange, baseAdvances);
        fragments.push({
          kind: "ruby",
          rubyKind: reading.kind,
          reading: reading.text,
          baseOffsetEm,
          baseAdvanceEm,
          readingGraphemes: positionReading(
            reading.text,
            baseOffsetEm,
            baseAdvanceEm,
            settings,
            measurer,
          ),
          ...common,
        });
        break;
      }
    }
  }

  return fragments;
}

function positionedLine(
  atoms: readonly Atom[],
  dispositions: ReadonlySet<number>,
  suppressed: readonly SuppressedGrapheme[],
  annotations: readonly ManuscriptAnnotation[],
  settings: NovelCompositionSettings,
  measurer: InlineMeasurer,
  baseAdvances: ReadonlyMap<number, number>,
): NovelLine {
  let offsetEm = 0;
  const graphemes = atoms.map(({ grapheme, advanceEm }, index): PositionedGrapheme => {
    const positioned: PositionedGrapheme = {
      kind: "grapheme",
      value: grapheme.value,
      range: grapheme.range,
      offsetEm,
      advanceEm,
      disposition: dispositions.has(index) ? "hanging" : "placed",
    };
    offsetEm += advanceEm;
    return positioned;
  });

  return {
    range: ManuscriptRange.merge([
      ...graphemes.map(({ range }) => range),
      ...suppressed.map(({ range }) => range),
    ]),
    advanceEm: offsetEm,
    graphemes,
    suppressed,
    annotations: annotationFragments(graphemes, annotations, settings, measurer, baseAdvances),
  };
}

function wrapSourceLine(
  sourceLine: MeasuredSourceLine,
  annotations: readonly ManuscriptAnnotation[],
  settings: NovelCompositionSettings,
  measurer: InlineMeasurer,
  baseAdvances: ReadonlyMap<number, number>,
): NovelLine[] {
  if (sourceLine.atoms.length === 0) return [NovelLineContract.empty()];

  const lines: NovelLine[] = [];
  let cursor = 0;
  while (cursor < sourceLine.atoms.length) {
    const suppressed: SuppressedGrapheme[] = [];
    if (lines.length > 0 && sourceLine.suppressedIndexes.has(cursor)) {
      const atom = sourceLine.atoms[cursor];
      if (atom !== undefined) {
        suppressed.push({
          kind: "suppressed",
          value: atom.grapheme.value,
          range: atom.grapheme.range,
          reason: "question-or-exclamation-gap",
        });
      }
      cursor += 1;
    }
    if (cursor >= sourceLine.atoms.length) break;

    const start = cursor;
    let advance = 0;
    while (cursor < sourceLine.atoms.length) {
      const atom = sourceLine.atoms[cursor];
      if (
        atom === undefined ||
        (cursor > start && advance + atom.advanceEm > settings.flow.lineLengthEm)
      ) {
        break;
      }
      advance += atom.advanceEm;
      cursor += 1;
    }

    let end = Math.max(start + 1, cursor);
    const hanging = new Set<number>();
    const next = sourceLine.atoms[end];
    if (next !== undefined && HANGING_PUNCTUATION.has(next.grapheme.value)) {
      hanging.add(end - start);
      end += 1;
    } else {
      while (
        end > start + 1 &&
        !legalBoundary(sourceLine.atoms, annotations, end, settings.flow.lineLengthEm)
      ) {
        end -= 1;
      }
    }

    const atoms = sourceLine.atoms.slice(start, end);
    lines.push(
      positionedLine(atoms, hanging, suppressed, annotations, settings, measurer, baseAdvances),
    );
    cursor = end;
  }

  return lines;
}

function blankLines(count: number): NovelLine[] {
  return Array.from({ length: count }, NovelLineContract.empty);
}

function buildPages(
  contentLines: readonly NovelLine[],
  settings: NovelCompositionSettings,
): NovelPage[] {
  const { linesPerStage, stagesPerPage } = settings.flow;
  const { stage: stageOffset, page: pageOffset } = settings.offsets;
  const usablePerStage = linesPerStage - LineOffset.total(stageOffset);
  const usablePerPage = usablePerStage * stagesPerPage;
  const pages: NovelPage[] = [];
  let contentIndex = 0;

  while (contentIndex < contentLines.length || pages.length === 0) {
    const stages: NovelStage[] = [];
    for (let stageIndex = 0; stageIndex < stagesPerPage; stageIndex += 1) {
      const lines: NovelLine[] = [];
      for (let position = 0; position < linesPerStage; position += 1) {
        const usableIndex = stageIndex * usablePerStage + position - stageOffset.leading;
        const withinStage =
          position >= stageOffset.leading && position < linesPerStage - stageOffset.trailing;
        const withinPage =
          usableIndex >= pageOffset.leading && usableIndex < usablePerPage - pageOffset.trailing;
        const next = contentLines[contentIndex];

        if (!withinStage || !withinPage || next === undefined) {
          lines.push(NovelLineContract.empty());
          continue;
        }
        lines.push(next);
        contentIndex += 1;
      }
      stages.push(NovelStage.of(lines));
    }
    pages.push(NovelPage.of(stages));
  }

  return pages;
}

function createCompose(measurer: InlineMeasurer) {
  return (
    manuscript: ParsedManuscript,
    settings: NovelCompositionSettings,
  ): ManuscriptResult<NovelLayout, { reason: string }> => {
    const sourceLines = displayedLines(manuscript.graphemes);
    const measured = sourceLines.map((line) =>
      measureSourceLine(line, manuscript.annotations, settings, measurer),
    );
    if (measured.some((line) => line === undefined)) {
      return ManuscriptResult.fail({
        reason: "inline measurer returned a negative or non-finite value",
      });
    }

    const baseAdvances = new Map<number, number>();
    for (const line of measured) {
      for (const atom of line?.atoms ?? []) {
        baseAdvances.set(atom.grapheme.range.graphemes.start, atom.advanceEm);
      }
    }

    const manuscriptLines = measured.flatMap((line) =>
      line === undefined
        ? []
        : wrapSourceLine(line, manuscript.annotations, settings, measurer, baseAdvances),
    );
    const pages = buildPages(
      [
        ...blankLines(settings.offsets.document.leading),
        ...manuscriptLines,
        ...blankLines(settings.offsets.document.trailing),
      ],
      settings,
    );

    return ManuscriptResult.succeed({
      pages,
      geometry: ManuscriptGeometry.of(settings.flow, settings.appearance),
      stats: {
        chars: sourceLines.reduce((total, line) => total + line.length, 0),
        sourceLines: sourceLines.length,
        pages: pages.length,
      },
    });
  };
}

export function createNovelComposer(
  options: Readonly<{ measurer: InlineMeasurer }>,
): ManuscriptComposer<NovelCompositionSettings, NovelLayout> {
  return {
    id: COMPOSER_ID,
    settingsSchema: NovelCompositionSettings.schema,
    layoutSchema: NovelLayoutContract.schema,
    compose: createCompose(options.measurer),
  };
}

export const novelComposer = createNovelComposer({ measurer: logicalInlineMeasurer });
