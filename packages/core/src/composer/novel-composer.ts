import * as v from "valibot";

import { graphemeSegmenter } from "../internal/segmenter";
import { NamespacedId } from "../namespaced-id";
import type { ManuscriptAnnotation } from "../parser/annotation/manuscript-annotation";
import type { RubyAnnotation, RubyReading } from "../parser/annotation/ruby-annotation";
import type { ParsedGrapheme } from "../parser/parsed-grapheme";
import type { ParsedManuscript } from "../parser/parsed-manuscript";
import { ManuscriptRange } from "../range/manuscript-range";
import { ManuscriptResult } from "../result/manuscript-result";
import type { ComposedAnnotationFragment } from "./composed-annotation-fragment";
import type {
  ComposedGlyph,
  ComposedInlineItem,
  SuppressedInlineItem,
} from "./composed-inline-item";
import type { ComposedManuscript } from "./composed-manuscript";
import { NovelCompositionSettings } from "./composition-settings";
import type { InlineMeasurer } from "./inline-measurer";
import { InlineMeasurement, logicalInlineMeasurer } from "./inline-measurer";
import { BoundaryRule } from "./internal/boundary-rule";
import { CompositionRun } from "./internal/composition-run";
import { JapaneseParagraph } from "./internal/japanese-paragraph";
import { defaultJapaneseTypesettingProfile } from "./internal/japanese-typesetting-profile";
import type { JapaneseCharacterClass } from "./internal/japanese-typesetting-rules";
import { layoutParagraph } from "./internal/paragraph-layout";
import type { ParagraphLinePlan } from "./internal/paragraph-line-plan";
import { RubyAssociation } from "./internal/ruby-association";
import { SourceSpace } from "./internal/source-space";
import { LineOffset } from "./line-offset";
import type { ManuscriptComposer } from "./manuscript-composer";
import { ManuscriptGeometry } from "./manuscript-geometry";
import type { NovelLayout } from "./novel-layout";
import { NovelLayout as NovelLayoutContract } from "./novel-layout";
import type { NovelLine } from "./novel-line";
import { NovelLine as NovelLineContract } from "./novel-line";
import { NovelPage } from "./novel-page";
import { NovelStage } from "./novel-stage";
import type { VerticalTextPresentation } from "./vertical-text-presentation";

const COMPOSER_ID = NamespacedId.of("kg/novel");
const TYPESETTING_PROFILE = defaultJapaneseTypesettingProfile;

type Atom = Readonly<{
  grapheme: ParsedGrapheme;
  runIndex: number;
  characterClass: JapaneseCharacterClass;
  intrinsicBoxAdvanceEm: number;
  boxAdvanceEm: number;
  renderAdvanceEm: number;
  renderOffsetEm: number;
  presentation: VerticalTextPresentation;
}>;

type MutableAtom = { -readonly [Key in keyof Atom]: Atom[Key] };

type MeasuredSourceLine = Readonly<{
  runs: readonly CompositionRun[];
  rubyAssociations: readonly RubyAssociation[];
  sourceSpaces: readonly SourceSpace[];
  atoms: readonly Atom[];
  suppressedIndexes: ReadonlySet<number>;
}>;

type AnnotationFragmentPlan = Readonly<{
  ranges: readonly ManuscriptRange[];
  groupReadings: readonly string[];
}>;

type SourceGlue = Extract<ComposedInlineItem, { kind: "glue"; origin: "source" }>;

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
  const measurement =
    role === "base"
      ? measurer({ ...context, role, presentation: presentationKind ?? "mixed" })
      : measurer({ ...context, role });
  const parsed = v.safeParse(InlineMeasurement.schema, measurement);
  if (!parsed.success) return undefined;
  const { advanceEm } = parsed.output;

  return advanceEm;
}

/**
 * Widen a base character by `extraEm` so a reading longer than it has room, keeping the character's
 * ink in the middle of the widened box.
 *
 * JLReq 3.3.6 sets such a reading solid and spends the surplus on the base instead: two units
 * between the base characters for one unit before the first and after the last. Handing every base
 * character an equal share of the surplus and centring it inside that share produces exactly those
 * proportions, and it is also the 中付き position JLReq 3.3.5 asks of a mono ruby whose reading
 * outruns its single base character.
 */
function widenForReading(atom: MutableAtom, extraEm: number): void {
  if (extraEm <= 0) return;
  atom.boxAdvanceEm += extraEm;
  atom.renderOffsetEm += extraEm / 2;
}

function measureSourceLine(
  sourceLine: readonly ParsedGrapheme[],
  annotations: readonly ManuscriptAnnotation[],
  settings: NovelCompositionSettings,
  measurer: InlineMeasurer,
): MeasuredSourceLine | undefined {
  const runs = CompositionRun.recognize(sourceLine);
  const rubyAssociations = RubyAssociation.collect(annotations, sourceLine);
  const presented = runs.flatMap((run, runIndex) =>
    run.members.map((grapheme) => ({
      grapheme,
      runIndex,
      presentation: CompositionRun.presentationOf(run),
    })),
  );
  const mutable = presented.map(({ grapheme, runIndex, presentation }) => {
    const renderAdvanceEm = measure(measurer, grapheme.value, "base", settings, presentation.kind);
    if (renderAdvanceEm === undefined) return undefined;
    const characterClass = TYPESETTING_PROFILE.classify({
      value: grapheme.value,
      presentation: presentation.kind,
    });
    const metrics = TYPESETTING_PROFILE.boxMetrics(characterClass, renderAdvanceEm);
    return {
      grapheme,
      runIndex,
      characterClass,
      intrinsicBoxAdvanceEm: metrics.advanceEm,
      boxAdvanceEm: metrics.advanceEm,
      renderAdvanceEm,
      renderOffsetEm: metrics.renderOffsetEm,
      presentation,
    };
  });
  if (mutable.some((atom) => atom === undefined)) return undefined;

  const atoms: MutableAtom[] = mutable.flatMap((atom) => (atom === undefined ? [] : [atom]));

  for (const association of rubyAssociations) {
    const { indexes } = association;
    const readingTexts =
      association.reading.kind === "group"
        ? [association.reading.text]
        : association.reading.segments;
    const hasInvalidReadingGrapheme = readingTexts.some((text) =>
      [...graphemeSegmenter.segment(text)].some(
        ({ segment }) => measure(measurer, segment, "ruby", settings) === undefined,
      ),
    );
    if (hasInvalidReadingGrapheme) return undefined;

    if (association.reading.kind === "group") {
      const readingAdvance = measure(measurer, association.reading.text, "ruby", settings);
      if (readingAdvance === undefined) return undefined;
      const baseAdvance = indexes.reduce(
        (total, index) => total + (atoms[index]?.boxAdvanceEm ?? 0),
        0,
      );
      const extra = Math.max(0, readingAdvance - baseAdvance) / indexes.length;
      for (const index of indexes) {
        const atom = atoms[index];
        if (atom !== undefined) widenForReading(atom, extra);
      }
      continue;
    }

    for (const [segmentIndex, index] of indexes.entries()) {
      const segment = association.reading.segments[segmentIndex];
      const atom = atoms[index];
      if (segment === undefined || atom === undefined) continue;
      const readingAdvance = measure(measurer, segment, "ruby", settings);
      if (readingAdvance === undefined) return undefined;
      widenForReading(atom, readingAdvance - atom.boxAdvanceEm);
    }
  }

  const sourceSpaces = SourceSpace.collect(
    sourceLine,
    atoms.map(({ boxAdvanceEm }) => boxAdvanceEm),
  );
  return {
    atoms,
    runs,
    rubyAssociations,
    sourceSpaces,
    suppressedIndexes: new Set(
      sourceSpaces.filter((space) => space.edgeBehavior === "suppress").map((space) => space.index),
    ),
  };
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
  graphemes: readonly ComposedGlyph[],
  suppressed: readonly SuppressedInlineItem[],
  sourceGlues: readonly SourceGlue[],
  annotation: ManuscriptAnnotation,
): ManuscriptRange | null {
  return ManuscriptRange.merge([
    ...graphemes
      .filter(({ range }) => ManuscriptRange.overlaps(range, annotation.range))
      .map(({ range }) => range),
    ...suppressed
      .filter(({ range }) => ManuscriptRange.overlaps(range, annotation.range))
      .map(({ range }) => range),
    ...sourceGlues
      .filter(({ range }) => ManuscriptRange.overlaps(range, annotation.range))
      .map(({ range }) => range),
  ]);
}

function annotationFragments(
  graphemes: readonly ComposedGlyph[],
  suppressed: readonly SuppressedInlineItem[],
  sourceGlues: readonly SourceGlue[],
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
    const fragmentRange = annotationFragmentRange(graphemes, suppressed, sourceGlues, annotation);
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
        const baseOffsetEm = first.layoutSpan.offsetEm;
        const baseAdvanceEm = last.layoutSpan.offsetEm + last.layoutSpan.advanceEm - baseOffsetEm;
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
  sourceGapIndexes: ReadonlySet<number>,
  plan: ParagraphLinePlan,
): NovelLine {
  const items: ComposedInlineItem[] = plan.suppressedIndexes.flatMap((index) => {
    const atom = atoms[index];
    return atom === undefined
      ? []
      : [
          {
            kind: "suppressed",
            value: atom.grapheme.value,
            range: atom.grapheme.range,
            reason: "question-or-exclamation-gap",
          } as const,
        ];
  });
  const spacings = new Map(plan.pairSpacings.map((spacing) => [spacing.boundary, spacing]));
  const characterSpacings = new Map(
    plan.characterSpacings.map((spacing) => [spacing.index, spacing]),
  );
  let offsetEm = 0;
  const adjustmentOf = (widthEm: number, naturalWidthEm: number) =>
    widthEm < naturalWidthEm ? "shrunk" : widthEm > naturalWidthEm ? "stretched" : "natural";
  const positionSpacing = (spacing: ParagraphLinePlan["pairSpacings"][number]) => {
    if (spacing.kind === "kern") {
      items.push({ kind: "kern", offsetEm, widthEm: spacing.widthEm });
    } else {
      items.push({
        kind: "glue",
        origin: "generated",
        offsetEm,
        widthEm: spacing.widthEm,
        naturalWidthEm: spacing.naturalWidthEm,
        adjustment: adjustmentOf(spacing.widthEm, spacing.naturalWidthEm),
      });
    }
    offsetEm += spacing.widthEm;
  };

  for (let index = plan.contentStart; index < plan.end; index += 1) {
    const spacing = spacings.get(index);
    if (spacing !== undefined) positionSpacing(spacing);

    const atom = atoms[index];
    if (atom === undefined) continue;
    // The ideographic space a `！` or `？` takes after it, and the western word space, which JLReq
    // states as an アキ rather than a character with a box. Both carry no ink and come from the source,
    // so both leave the line as source glue; only the word space is resized by line adjustment.
    const characterSpacing = characterSpacings.get(index);
    if (sourceGapIndexes.has(index) || characterSpacing !== undefined) {
      const naturalWidthEm = characterSpacing?.naturalWidthEm ?? atom.boxAdvanceEm;
      const widthEm = characterSpacing?.widthEm ?? atom.boxAdvanceEm;
      items.push({
        kind: "glue",
        origin: "source",
        value: atom.grapheme.value,
        range: atom.grapheme.range,
        offsetEm,
        widthEm,
        naturalWidthEm,
        adjustment: adjustmentOf(widthEm, naturalWidthEm),
      });
      offsetEm += widthEm;
      continue;
    }

    const hanging = plan.hangingIndex === index;
    const layoutAdvanceEm = hanging ? 0 : atom.boxAdvanceEm;
    items.push({
      kind: "glyph",
      value: atom.grapheme.value,
      range: atom.grapheme.range,
      layoutSpan: { offsetEm, advanceEm: layoutAdvanceEm },
      renderSpan: {
        offsetEm: offsetEm + atom.renderOffsetEm,
        advanceEm: atom.renderAdvanceEm,
      },
      disposition: hanging ? "hanging" : "placed",
      presentation: atom.presentation,
    });
    offsetEm += layoutAdvanceEm;
  }
  const trailingSpacing = spacings.get(plan.end);
  if (trailingSpacing !== undefined) positionSpacing(trailingSpacing);

  const ranges = items.flatMap((item) =>
    item.kind === "glyph" ||
    item.kind === "suppressed" ||
    (item.kind === "glue" && item.origin === "source")
      ? [item.range]
      : [],
  );
  return {
    range: ManuscriptRange.merge(ranges),
    inlineSizeEm: Math.max(0, plan.inlineSizeEm),
    items,
    break: plan.break,
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
  const profile = TYPESETTING_PROFILE;
  const characters = sourceLine.atoms.map((atom, index) => ({
    boxAdvanceEm: atom.boxAdvanceEm,
    sourceGap: sourceLine.suppressedIndexes.has(index),
    characterClass: atom.characterClass,
  }));
  const rubyInteriors = RubyAssociation.fittableInteriors(
    sourceLine.rubyAssociations,
    characters.map(({ boxAdvanceEm }) => boxAdvanceEm),
    settings.flow.lineLengthEm,
  );
  const resolveBoundary = (leftIndex: number, rightIndex: number): BoundaryRule | undefined => {
    const left = sourceLine.atoms[leftIndex];
    const right = sourceLine.atoms[rightIndex];
    if (left === undefined || right === undefined) return undefined;
    return BoundaryRule.resolve(left.characterClass, right.characterClass, profile, {
      runInterior: left.runIndex === right.runIndex,
      rubyInterior: rubyInteriors.has(rightIndex),
      sourceGap:
        sourceLine.suppressedIndexes.has(leftIndex) || sourceLine.suppressedIndexes.has(rightIndex),
    });
  };
  const boundaries = Array.from({ length: characters.length + 1 }, (_, boundary) =>
    resolveBoundary(boundary - 1, boundary),
  );
  const nextVisible = Array.from<number>({ length: characters.length + 1 }).fill(characters.length);
  for (let index = characters.length - 1; index >= 0; index -= 1) {
    nextVisible[index] =
      characters[index]?.sourceGap === true ? (nextVisible[index + 1] ?? characters.length) : index;
  }
  const acrossGaps = characters.map((_, left) =>
    resolveBoundary(left, nextVisible[left + 1] ?? characters.length),
  );
  const paragraph = JapaneseParagraph.of(
    characters,
    boundaries,
    profile,
    settings.flow.lineLengthEm,
  );
  const plans = layoutParagraph(
    paragraph.elements,
    settings.flow.lineLengthEm,
    paragraph.resolveCandidate,
    (left, right) =>
      (right === left + 1 ? boundaries[right] : acrossGaps[left])?.break.kind !== "prohibited",
  );
  const lines = plans.map((plan) =>
    positionedLine(sourceLine.atoms, sourceLine.suppressedIndexes, plan),
  );

  const fragmentPlansByAnnotation = new Map(
    annotations.map((annotation) => {
      const ranges = lines.flatMap((line) => {
        const graphemes = line.items.filter((item) => item.kind === "glyph");
        const suppressed = line.items.filter((item) => item.kind === "suppressed");
        const sourceGlues = line.items.flatMap((item) =>
          item.kind === "glue" && item.origin === "source" ? [item] : [],
        );
        const range = annotationFragmentRange(graphemes, suppressed, sourceGlues, annotation);
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
    inlineSizeEm: line.inlineSizeEm,
    items: line.items,
    break: line.break,
    annotations: annotationFragments(
      line.items.filter((item) => item.kind === "glyph"),
      line.items.filter((item) => item.kind === "suppressed"),
      line.items.flatMap((item) =>
        item.kind === "glue" && item.origin === "source" ? [item] : [],
      ),
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
        baseAdvances.set(atom.grapheme.range.graphemes.start, atom.boxAdvanceEm);
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
