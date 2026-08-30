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
import type { VerticalTextPresentation } from "./vertical-text-presentation";

const COMPOSER_ID = NamespacedId.of("kg/novel");

const LINE_START_PROHIBITED = new Set(
  `、。，．・：；？！‼⁇⁈⁉ヽヾゝゞ々ーァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎゕゖ${CLOSING_BRACKETS}】〙〟｠»`,
);
const LINE_END_PROHIBITED = new Set(`${OPENING_BRACKETS}【〘〝｟«`);
const HANGING_PUNCTUATION = new Set("、。，．！？");
const INSEPARABLE_PAIRS = new Set(["……", "――", "──", "〳〵"]);
const ASCII_ALPHANUMERIC = /^[A-Za-z0-9]$/u;
const ASCII_TWO_DIGITS = /^[0-9]{2}$/u;
const UPRIGHT_LATIN_ABBREVIATION = /^(?:[A-Z]+|[A-Z][a-z]{1,2})$/u;
const FULLWIDTH_ALPHANUMERIC = /^[Ａ-Ｚａ-ｚ０-９]$/u;

type Atom = Readonly<{
  grapheme: ParsedGrapheme;
  advanceEm: number;
  presentation: VerticalTextPresentation;
}>;

type MeasuredSourceLine = Readonly<{
  atoms: readonly Atom[];
  suppressedIndexes: ReadonlySet<number>;
}>;

type AnnotationFragmentPlan = Readonly<{
  ranges: readonly ManuscriptRange[];
  groupReadings: readonly string[];
}>;

export type NovelComposedManuscript = ComposedManuscript<NovelCompositionSettings, NovelLayout>;

function presentation(
  kind: VerticalTextPresentation["kind"],
  graphemes: readonly ParsedGrapheme[],
): VerticalTextPresentation | undefined {
  const groupRange = ManuscriptRange.merge(graphemes.map(({ range }) => range));
  return groupRange === null ? undefined : { kind, groupRange };
}

function presentedSourceLine(
  sourceLine: readonly ParsedGrapheme[],
): Array<Readonly<{ grapheme: ParsedGrapheme; presentation: VerticalTextPresentation }>> {
  const presented: Array<
    Readonly<{ grapheme: ParsedGrapheme; presentation: VerticalTextPresentation }>
  > = [];
  let cursor = 0;

  while (cursor < sourceLine.length) {
    const first = sourceLine[cursor];
    if (first === undefined) break;

    if (!ASCII_ALPHANUMERIC.test(first.value)) {
      const itemPresentation = presentation(
        FULLWIDTH_ALPHANUMERIC.test(first.value) ? "upright" : "mixed",
        [first],
      );
      if (itemPresentation !== undefined) {
        presented.push({ grapheme: first, presentation: itemPresentation });
      }
      cursor += 1;
      continue;
    }

    const start = cursor;
    while (ASCII_ALPHANUMERIC.test(sourceLine[cursor]?.value ?? "")) cursor += 1;
    const run = sourceLine.slice(start, cursor);
    const text = run.map(({ value }) => value).join("");
    const kind = ASCII_TWO_DIGITS.test(text)
      ? "tate-chu-yoko"
      : text.length === 1 || UPRIGHT_LATIN_ABBREVIATION.test(text)
        ? "upright"
        : "sideways";
    const runPresentation = presentation(kind, run);
    if (runPresentation !== undefined) {
      presented.push(...run.map((grapheme) => ({ grapheme, presentation: runPresentation })));
    }
  }

  return presented;
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
  presentationKind?: VerticalTextPresentation["kind"],
): number | undefined {
  const context = {
    text,
    fontPreset: settings.appearance.fontPreset,
    writingMode: "vertical-rl",
  } as const;
  const value =
    role === "base"
      ? measurer({ ...context, role, presentation: presentationKind ?? "mixed" })
      : measurer({ ...context, role });

  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function measureSourceLine(
  sourceLine: readonly ParsedGrapheme[],
  annotations: readonly ManuscriptAnnotation[],
  settings: NovelCompositionSettings,
  measurer: InlineMeasurer,
): MeasuredSourceLine | undefined {
  const mutable = presentedSourceLine(sourceLine).map(({ grapheme, presentation }) => {
    const advanceEm = measure(measurer, grapheme.value, "base", settings, presentation.kind);
    return advanceEm === undefined ? undefined : { grapheme, advanceEm, presentation };
  });
  if (mutable.some((atom) => atom === undefined)) return undefined;

  const atoms: Array<{
    grapheme: ParsedGrapheme;
    advanceEm: number;
    presentation: VerticalTextPresentation;
  }> = mutable.flatMap((atom) => (atom === undefined ? [] : [atom]));

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

function samePresentationGroup(left: Atom, right: Atom): boolean {
  return (
    left.presentation.groupRange.graphemes.start ===
      right.presentation.groupRange.graphemes.start &&
    left.presentation.groupRange.graphemes.end === right.presentation.groupRange.graphemes.end
  );
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
    !samePresentationGroup(left, right) &&
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

function groupReadingsForFragments(
  annotation: RubyAnnotation,
  fragmentRanges: readonly ManuscriptRange[],
  baseAdvances: ReadonlyMap<number, number>,
): string[] {
  const baseLength = annotation.range.graphemes.end - annotation.range.graphemes.start;
  if (annotation.reading.kind !== "group") return [];
  const reading = [...graphemeSegmenter.segment(annotation.reading.text)].map(
    ({ segment }) => segment,
  );
  const advances = Array.from({ length: baseLength }, (_, index) =>
    baseAdvances.get(annotation.range.graphemes.start + index),
  );
  const measured = advances.every((advance) => advance !== undefined);
  const advanceFor = (fragment: ManuscriptRange): number => {
    const fragmentStart = fragment.graphemes.start - annotation.range.graphemes.start;
    const fragmentLength = fragment.graphemes.end - fragment.graphemes.start;
    return measured
      ? advances
          .slice(fragmentStart, fragmentStart + fragmentLength)
          .reduce((total, advance) => total + advance, 0)
      : fragmentLength;
  };
  const weights = fragmentRanges.map(advanceFor);
  const measuredTotal = weights.reduce((total, weight) => total + weight, 0);
  const effectiveWeights =
    measuredTotal > 0
      ? weights
      : fragmentRanges.map(({ graphemes }) => graphemes.end - graphemes.start);
  const totalWeight = effectiveWeights.reduce((total, weight) => total + weight, 0);
  const reserveEveryFragment = reading.length >= fragmentRanges.length;
  const fragments: string[] = [];
  let readingStart = 0;
  let accumulatedWeight = 0;

  for (const [index, weight] of effectiveWeights.entries()) {
    accumulatedWeight += weight;
    const remainingFragments = effectiveWeights.length - index - 1;
    const proportionalEnd =
      index === effectiveWeights.length - 1
        ? reading.length
        : Math.round((accumulatedWeight * reading.length) / totalWeight);
    const minimumEnd = reserveEveryFragment ? readingStart + 1 : readingStart;
    const maximumEnd = reserveEveryFragment ? reading.length - remainingFragments : reading.length;
    const readingEnd = Math.min(maximumEnd, Math.max(minimumEnd, proportionalEnd));
    fragments.push(reading.slice(readingStart, readingEnd).join(""));
    readingStart = readingEnd;
  }

  return fragments;
}

function readingForFragment(
  annotation: RubyAnnotation,
  range: ManuscriptRange,
  fragmentPlan: AnnotationFragmentPlan,
): Readonly<{ kind: RubyReading["kind"]; text: string }> {
  const start = range.graphemes.start - annotation.range.graphemes.start;
  const length = range.graphemes.end - range.graphemes.start;

  if (annotation.reading.kind !== "group") {
    return {
      kind: annotation.reading.kind,
      text: annotation.reading.segments.slice(start, start + length).join(""),
    };
  }

  const fragmentIndex = fragmentPlan.ranges.findIndex(
    ({ graphemes }) =>
      graphemes.start === range.graphemes.start && graphemes.end === range.graphemes.end,
  );
  return {
    kind: "group",
    text: fragmentPlan.groupReadings[fragmentIndex] ?? "",
  };
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

function annotationFragmentRange(
  graphemes: readonly PositionedGrapheme[],
  suppressed: readonly SuppressedGrapheme[],
  annotation: ManuscriptAnnotation,
): ManuscriptRange | null {
  return ManuscriptRange.merge([
    ...graphemes
      .filter(({ range }) => ManuscriptRange.overlaps(range, annotation.range))
      .map(({ range }) => range),
    ...suppressed
      .filter(({ range }) => ManuscriptRange.overlaps(range, annotation.range))
      .map(({ range }) => range),
  ]);
}

function annotationFragments(
  graphemes: readonly PositionedGrapheme[],
  suppressed: readonly SuppressedGrapheme[],
  annotations: readonly ManuscriptAnnotation[],
  settings: NovelCompositionSettings,
  measurer: InlineMeasurer,
  fragmentPlansByAnnotation: ReadonlyMap<ManuscriptAnnotation, AnnotationFragmentPlan>,
): ComposedAnnotationFragment[] {
  const fragments: ComposedAnnotationFragment[] = [];

  for (const annotation of annotations) {
    const covered = graphemes.filter(({ range }) =>
      ManuscriptRange.overlaps(range, annotation.range),
    );
    const fragmentRange = annotationFragmentRange(graphemes, suppressed, annotation);
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
        const fragmentPlan = fragmentPlansByAnnotation.get(annotation);
        if (fragmentPlan === undefined) break;
        const baseOffsetEm = first.offsetEm;
        const baseAdvanceEm = last.offsetEm + last.advanceEm - baseOffsetEm;
        const reading = readingForFragment(annotation, fragmentRange, fragmentPlan);
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
): NovelLine {
  let offsetEm = 0;
  const graphemes = atoms.map(
    ({ grapheme, advanceEm, presentation }, index): PositionedGrapheme => {
      const positioned: PositionedGrapheme = {
        kind: "grapheme",
        value: grapheme.value,
        range: grapheme.range,
        offsetEm,
        advanceEm,
        disposition: dispositions.has(index) ? "hanging" : "placed",
        presentation,
      };
      offsetEm += advanceEm;
      return positioned;
    },
  );

  return {
    range: ManuscriptRange.merge([
      ...graphemes.map(({ range }) => range),
      ...suppressed.map(({ range }) => range),
    ]),
    advanceEm: offsetEm,
    graphemes,
    suppressed,
    annotations: [],
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
    if (cursor >= sourceLine.atoms.length) {
      const previous = lines.at(-1);
      if (previous !== undefined && suppressed.length > 0) {
        lines[lines.length - 1] = {
          ...previous,
          range: ManuscriptRange.merge([
            ...(previous.range === null ? [] : [previous.range]),
            ...suppressed.map(({ range }) => range),
          ]),
          suppressed: [...previous.suppressed, ...suppressed],
        };
      }
      break;
    }

    const start = cursor;
    let advance = 0;
    while (cursor < sourceLine.atoms.length) {
      const atom = sourceLine.atoms[cursor];
      if (atom === undefined) break;
      const previous = sourceLine.atoms[cursor - 1];
      const beginsPresentationGroup =
        previous === undefined || !samePresentationGroup(previous, atom);
      if (cursor > start && beginsPresentationGroup) {
        let groupAdvance = 0;
        for (let index = cursor; index < sourceLine.atoms.length; index += 1) {
          const member = sourceLine.atoms[index];
          if (member === undefined || !samePresentationGroup(atom, member)) break;
          groupAdvance += member.advanceEm;
        }
        if (advance + groupAdvance > settings.flow.lineLengthEm) break;
      }

      const exceedsLine = cursor > start && advance + atom.advanceEm > settings.flow.lineLengthEm;
      if (exceedsLine && (previous === undefined || !samePresentationGroup(previous, atom))) break;
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
    lines.push(positionedLine(atoms, hanging, suppressed));
    cursor = end;
  }

  const fragmentPlansByAnnotation = new Map(
    annotations.map((annotation) => {
      const ranges = lines.flatMap((line) => {
        const range = annotationFragmentRange(line.graphemes, line.suppressed, annotation);
        return range === null ? [] : [range];
      });
      const groupReadings =
        annotation.kind === "ruby"
          ? groupReadingsForFragments(annotation, ranges, baseAdvances)
          : [];

      return [annotation, { ranges, groupReadings }] as const;
    }),
  );

  return lines.map((line) => ({
    range: line.range,
    advanceEm: line.advanceEm,
    graphemes: line.graphemes,
    suppressed: line.suppressed,
    annotations: annotationFragments(
      line.graphemes,
      line.suppressed,
      annotations,
      settings,
      measurer,
      fragmentPlansByAnnotation,
    ),
  }));
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
