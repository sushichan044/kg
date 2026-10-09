import { graphemeSegmenter } from "../internal/segmenter";
import { NamespacedId } from "../namespaced-id";
import type { ManuscriptAnnotation } from "../parser/annotation/manuscript-annotation";
import type { ParsedGrapheme } from "../parser/parsed-grapheme";
import type { ParsedManuscript } from "../parser/parsed-manuscript";
import { ManuscriptRange } from "../range/manuscript-range";
import { ManuscriptResult } from "../result/manuscript-result";
import type { CombinedGlyphUnit } from "./combined-glyph-unit";
import type { ComposedAnnotationFragment } from "./composed-annotation-fragment";
import type { SuppressedInlineItem } from "./composed-inline-item";
import type { ComposedManuscript } from "./composed-manuscript";
import { NovelCompositionSettings } from "./composition-settings";
import type { InlineSpan } from "./inline-span";
import { BoundaryRule } from "./internal/boundary-rule";
import type { BoxAdjustment } from "./internal/box-adjustment";
import { CompositionRun } from "./internal/composition-run";
import { GroupRubyAllocation } from "./internal/group-ruby-allocation";
import { JapaneseParagraph } from "./internal/japanese-paragraph";
import { defaultJapaneseTypesettingProfile } from "./internal/japanese-typesetting-profile";
import type { JapaneseCharacterClass } from "./internal/japanese-typesetting-rules";
import { MeasurementSession } from "./internal/measurement-session";
import { NovelSourceContract } from "./internal/novel-source-contract";
import { layoutParagraph } from "./internal/paragraph-layout";
import type { ParagraphLinePlan } from "./internal/paragraph-line-plan";
import { RubyAssociation } from "./internal/ruby-association";
import { RubyLineLayout } from "./internal/ruby-line-layout";
import type { RubyLineBase, RubyLinePlacement, RubyLineSegment } from "./internal/ruby-line-layout";
import { SourceSpace } from "./internal/source-space";
import { LineOffset } from "./line-offset";
import type { ManuscriptComposer } from "./manuscript-composer";
import { ManuscriptGeometry } from "./manuscript-geometry";
import { MeasurementTextRange } from "./measurement-text-range";
import type { NovelLayout } from "./novel-layout";
import { NovelLayout as NovelLayoutContract } from "./novel-layout";
import type { NovelLine } from "./novel-line";
import { NovelLine as NovelLineContract } from "./novel-line";
import { NovelPage } from "./novel-page";
import { NovelStage } from "./novel-stage";
import { PositionedInlineItem } from "./positioned-inline-item";
import type { PresentationKind } from "./presentation-kind";
import type { RunMeasurer } from "./run-measurer";
import { logicalRunMeasurer } from "./run-measurer";
import type { SingleGlyphUnit } from "./single-glyph-unit";
import { SourcePlacement } from "./source-placement";

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
  presentation: PresentationKind;
  clusterRange: ManuscriptRange | null;
  combineRun: boolean;
}>;

type MeasuredSourceLine = Readonly<{
  runs: readonly CompositionRun[];
  rubyAssociations: readonly RubyAssociation[];
  sourceSpaces: readonly SourceSpace[];
  atoms: readonly Atom[];
  suppressedIndexes: ReadonlySet<number>;
  candidateReadings: readonly RubyLineSegment[];
  groupReadings: readonly GroupRubyAllocation[];
}>;

type RenderUnit = SingleGlyphUnit | CombinedGlyphUnit;

type SourceGlue = Extract<PositionedInlineItem, { kind: "glue"; origin: "source" }>;

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

function measureSourceLine(
  sourceLine: readonly ParsedGrapheme[],
  annotations: readonly ManuscriptAnnotation[],
  measurements: MeasurementSession,
): MeasuredSourceLine | undefined {
  const runs = CompositionRun.recognize(sourceLine);
  const rubyAssociations = RubyAssociation.collect(annotations, sourceLine);
  const atoms: Atom[] = [];
  for (const [runIndex, run] of runs.entries()) {
    const text = run.members.map(({ value }) => value).join("");
    const pieces = measurements.pieces(text, "base", run.presentation);
    if (pieces === undefined) return undefined;
    const combineRun = run.presentation === "tate-chu-yoko" || pieces.length < run.members.length;
    let memberStart = 0;
    for (const piece of pieces) {
      const memberCount = [...graphemeSegmenter.segment(piece.value)].length;
      const members = run.members.slice(memberStart, memberStart + memberCount);
      const clusterRange =
        memberCount > 1 ? ManuscriptRange.merge(members.map(({ range }) => range)) : null;
      for (const [memberIndex, grapheme] of members.entries()) {
        const first = memberIndex === 0;
        const renderAdvanceEm = first ? piece.renderSpan.advanceEm : 0;
        const measuredAdvanceEm = first ? piece.layoutSpan.advanceEm : 0;
        const characterClass = TYPESETTING_PROFILE.classify({
          value: grapheme.value,
          presentation: run.presentation,
        });
        const metrics = TYPESETTING_PROFILE.boxMetrics(characterClass, measuredAdvanceEm);
        atoms.push({
          grapheme,
          runIndex,
          characterClass,
          intrinsicBoxAdvanceEm: metrics.advanceEm,
          boxAdvanceEm: metrics.advanceEm,
          renderAdvanceEm,
          renderOffsetEm:
            metrics.renderOffsetEm +
            (first ? piece.renderSpan.offsetEm - piece.layoutSpan.offsetEm : 0),
          presentation: run.presentation,
          clusterRange,
          combineRun,
        });
      }
      memberStart += memberCount;
    }
  }

  const candidateReadings: RubyLineSegment[] = [];
  const groupReadings: GroupRubyAllocation[] = [];
  const baseAdvances = atoms.map((atom) => atom.boxAdvanceEm);
  const physicalRange = (first: number, last: number) => {
    const left = atoms[first];
    const right = atoms[last];
    while (first > 0 && left?.combineRun === true && atoms[first - 1]?.runIndex === left.runIndex)
      first -= 1;
    while (
      last + 1 < atoms.length &&
      right?.combineRun === true &&
      atoms[last + 1]?.runIndex === right.runIndex
    )
      last += 1;
    return { start: first, end: last + 1 };
  };
  for (const association of rubyAssociations) {
    const { indexes } = association;
    const readingTexts =
      association.reading.kind === "group"
        ? [association.reading.text]
        : association.reading.segments;
    if (readingTexts.some((text) => measurements.pieces(text, "ruby") === undefined))
      return undefined;

    if (association.reading.kind === "group") {
      const pieces = measurements.pieces(association.reading.text, "ruby");
      if (pieces === undefined) return undefined;
      const group = GroupRubyAllocation.prepare(association, pieces, baseAdvances);
      if (group === undefined) return undefined;
      groupReadings.push(group);
      continue;
    }

    for (const [segmentIndex, index] of indexes.entries()) {
      const segment = association.reading.segments[segmentIndex];
      const atom = atoms[index];
      if (segment === undefined || atom === undefined) continue;
      const pieces = measurements.pieces(segment, "ruby");
      if (pieces === undefined) return undefined;
      candidateReadings.push({ association, ...physicalRange(index, index), pieces });
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
    candidateReadings,
    groupReadings,
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

function annotationFragmentRange(
  graphemes: readonly RenderUnit[],
  suppressed: readonly SuppressedInlineItem[],
  sourceGlues: readonly SourceGlue[],
  annotation: ManuscriptAnnotation,
): ManuscriptRange | null {
  return ManuscriptRange.merge([
    ...graphemes
      .flatMap((unit) => unit.sources.flatMap(SourcePlacement.ranges))
      .filter((range) => ManuscriptRange.overlaps(range, annotation.range)),
    ...suppressed
      .filter(({ range }) => ManuscriptRange.overlaps(range, annotation.range))
      .map(({ range }) => range),
    ...sourceGlues
      .filter(({ range }) => ManuscriptRange.overlaps(range, annotation.range))
      .map(({ range }) => range),
  ]);
}

function annotationFragments(
  graphemes: readonly RenderUnit[],
  suppressed: readonly SuppressedInlineItem[],
  sourceGlues: readonly SourceGlue[],
  annotations: readonly ManuscriptAnnotation[],
  candidatePlacements: readonly RubyLinePlacement[],
): ComposedAnnotationFragment[] | undefined {
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
        fragments.push({
          kind: "emphasis",
          mark: annotation.mark,
          placements: covered
            .filter(
              (unit) =>
                annotations.find(
                  (other) =>
                    other.kind === "emphasis" && ManuscriptRange.overlaps(unit.range, other.range),
                ) === annotation,
            )
            .map((unit) => ({
              side: "before",
              inlineSpan: unit.renderSpan,
              blockOffsetEm: -0.5,
              blockSizeEm: 0.5,
            })),
          ...common,
        });
        break;
      }
      case "ruby": {
        const resolved = candidatePlacements.filter(
          ({ segment }) => segment.association.baseRange === annotation.range,
        );
        if (resolved.length > 0) {
          let textOffset = 0;
          const readingItems = resolved.flatMap(({ items }) => {
            const mapped = items.map((item) => ({
              ...item,
              textRange: MeasurementTextRange.of({
                start: textOffset + item.textRange.start,
                end: textOffset + item.textRange.end,
              }),
            }));
            textOffset += items.at(-1)?.textRange.end ?? 0;
            return mapped;
          });
          fragments.push({
            kind: "ruby",
            rubyKind: annotation.reading.kind,
            reading: readingItems.map(({ value }) => value).join(""),
            readingItems,
            ...common,
          });
          break;
        }
        return undefined;
      }
    }
  }

  for (const unit of graphemes.filter((glyph) => glyph.kind === "combined-glyph")) {
    const readings = fragments.filter(
      (fragment) =>
        fragment.kind === "ruby" && ManuscriptRange.overlaps(fragment.fragmentRange, unit.range),
    );
    for (const [index, left] of readings.entries()) {
      if (left.kind !== "ruby") continue;
      if (
        readings
          .slice(index + 1)
          .some(
            (right) =>
              right.kind === "ruby" &&
              left.readingItems.some(({ placement: a }) =>
                right.readingItems.some(
                  ({ placement: b }) =>
                    a.inlineSpan.offsetEm < b.inlineSpan.offsetEm + b.inlineSpan.advanceEm - 1e-9 &&
                    b.inlineSpan.offsetEm < a.inlineSpan.offsetEm + a.inlineSpan.advanceEm - 1e-9 &&
                    a.blockOffsetEm < b.blockOffsetEm + b.blockSizeEm &&
                    b.blockOffsetEm < a.blockOffsetEm + a.blockSizeEm,
                ),
              ),
          )
      )
        return undefined;
    }
  }
  return fragments;
}

type PositionedMember = Readonly<{
  kind: "member";
  atom: Atom;
  layoutSpan: InlineSpan;
  renderSpan: InlineSpan;
  disposition: "placed" | "hanging";
}>;

type PositionedSpacing = Exclude<PositionedInlineItem, RenderUnit>;

function renderUnits(
  raw: ReadonlyArray<PositionedMember | PositionedSpacing>,
): PositionedInlineItem[] | undefined {
  const items: PositionedInlineItem[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const first = raw[index];
    if (first === undefined) continue;
    if (first.kind !== "member") {
      items.push(first);
      continue;
    }
    const members = [first];
    if (first.atom.combineRun) {
      while (index + 1 < raw.length) {
        const next = raw[index + 1];
        if (next?.kind !== "member" || next.atom.runIndex !== first.atom.runIndex) break;
        members.push(next);
        index += 1;
      }
    }
    const last = members.at(-1);
    if (last === undefined) return undefined;
    const range = ManuscriptRange.merge(members.map(({ atom }) => atom.grapheme.range));
    if (range === null) return undefined;
    const sources: SourcePlacement[] = [];
    for (let memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
      const member = members[memberIndex];
      if (member === undefined) return undefined;
      const cluster = member.atom.clusterRange;
      if (cluster === null) {
        sources.push({
          kind: "exact",
          range: member.atom.grapheme.range,
          layoutSpan: member.layoutSpan,
        });
        continue;
      }
      const shared = members.slice(
        memberIndex,
        memberIndex + cluster.graphemes.end - cluster.graphemes.start,
      );
      if (
        shared.some(
          ({ atom }) =>
            atom.clusterRange === null ||
            atom.clusterRange.graphemes.start !== cluster.graphemes.start ||
            atom.clusterRange.graphemes.end !== cluster.graphemes.end,
        )
      )
        return undefined;
      const end = shared.at(-1);
      if (end === undefined || shared.length !== cluster.graphemes.end - cluster.graphemes.start)
        return undefined;
      sources.push({
        kind: "shared",
        ranges: shared.map(({ atom }) => atom.grapheme.range),
        layoutSpan: {
          offsetEm: member.layoutSpan.offsetEm,
          advanceEm:
            end.layoutSpan.offsetEm + end.layoutSpan.advanceEm - member.layoutSpan.offsetEm,
        },
      });
      memberIndex += shared.length - 1;
    }
    let renderStart = Number.POSITIVE_INFINITY;
    let renderEnd = Number.NEGATIVE_INFINITY;
    for (const { atom, renderSpan } of members) {
      if (
        atom.clusterRange !== null &&
        atom.grapheme.range.graphemes.start !== atom.clusterRange.graphemes.start
      )
        continue;
      renderStart = Math.min(renderStart, renderSpan.offsetEm);
      renderEnd = Math.max(renderEnd, renderSpan.offsetEm + renderSpan.advanceEm);
    }
    const common = {
      value: members.map(({ atom }) => atom.grapheme.value).join(""),
      range,
      sources,
      layoutSpan: {
        offsetEm: first.layoutSpan.offsetEm,
        advanceEm: last.layoutSpan.offsetEm + last.layoutSpan.advanceEm - first.layoutSpan.offsetEm,
      },
      renderSpan: { offsetEm: renderStart, advanceEm: renderEnd - renderStart },
    };
    const presentation = first.atom.presentation;
    if (first.atom.combineRun) {
      if (members.length < 2 || (presentation !== "tate-chu-yoko" && presentation !== "sideways"))
        return undefined;
      items.push({ ...common, kind: "combined-glyph", presentation, disposition: "placed" });
    } else {
      if (presentation === "tate-chu-yoko") return undefined;
      items.push({ ...common, kind: "glyph", presentation, disposition: first.disposition });
    }
  }
  return items;
}

function positionedLine(
  atoms: readonly Atom[],
  sourceGapIndexes: ReadonlySet<number>,
  plan: ParagraphLinePlan,
): NovelLine | undefined {
  const items: Array<PositionedMember | PositionedSpacing> = plan.suppressedIndexes.flatMap(
    (index) => {
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
    },
  );
  const spacings = new Map(plan.pairSpacings.map((spacing) => [spacing.boundary, spacing]));
  const characterSpacings = new Map(
    plan.characterSpacings.map((spacing) => [spacing.index, spacing]),
  );
  const boxAdjustments = new Map(plan.boxAdjustments?.map((box) => [box.index, box]));
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
    const adjusted = boxAdjustments.get(index);
    const layoutAdvanceEm = hanging ? 0 : (adjusted?.advanceEm ?? atom.boxAdvanceEm);
    items.push({
      kind: "member",
      atom,
      layoutSpan: { offsetEm, advanceEm: layoutAdvanceEm },
      renderSpan: {
        offsetEm: offsetEm + (adjusted?.renderOffsetEm ?? atom.renderOffsetEm),
        advanceEm: atom.renderAdvanceEm,
      },
      disposition: hanging ? "hanging" : "placed",
    });
    offsetEm += layoutAdvanceEm;
  }
  const trailingSpacing = spacings.get(plan.end);
  if (trailingSpacing !== undefined) positionSpacing(trailingSpacing);

  const positioned = renderUnits(items);
  if (positioned === undefined) return undefined;
  const ranges = positioned.flatMap((item) =>
    PositionedInlineItem.isRenderUnit(item) ||
    item.kind === "suppressed" ||
    (item.kind === "glue" && item.origin === "source")
      ? [item.range]
      : [],
  );
  return {
    range: ManuscriptRange.merge(ranges),
    inlineSizeEm: Math.max(0, plan.inlineSizeEm),
    items: positioned,
    break: plan.break,
    annotations: [],
  };
}

function wrapSourceLine(
  sourceLine: MeasuredSourceLine,
  annotations: readonly ManuscriptAnnotation[],
  settings: NovelCompositionSettings,
): NovelLine[] | undefined {
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
    new Set(
      sourceLine.groupReadings
        .filter(
          (group) =>
            Math.max(
              group.basePrefixEm.at(-1) ?? 0,
              group.pieces.reduce((sum, piece) => sum + piece.layoutSpan.advanceEm, 0),
            ) <= settings.flow.lineLengthEm,
        )
        .map((group) => group.association),
    ),
  );
  const rubyByIndex = new Map(
    sourceLine.rubyAssociations.flatMap((association) =>
      association.indexes.map((index) => [index, association] as const),
    ),
  );
  const resolveBoundary = (leftIndex: number, rightIndex: number): BoundaryRule | undefined => {
    const left = sourceLine.atoms[leftIndex];
    const right = sourceLine.atoms[rightIndex];
    if (left === undefined || right === undefined) return undefined;
    const rule = BoundaryRule.resolve(left.characterClass, right.characterClass, profile, {
      runInterior: left.runIndex === right.runIndex,
      rubyInterior: rubyInteriors.has(rightIndex),
      sourceGap:
        sourceLine.suppressedIndexes.has(leftIndex) || sourceLine.suppressedIndexes.has(rightIndex),
    });
    const compound = rubyByIndex.get(leftIndex);
    return compound?.reading.kind === "jukugo" && compound === rubyByIndex.get(rightIndex)
      ? { ...rule, spacing: null, finalStretch: false }
      : rule;
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
  const rubyBases: RubyLineBase[] = sourceLine.atoms.map((atom, index) => {
    const association = rubyByIndex.get(index);
    return {
      lexicalClass: atom.characterClass,
      effectiveClass:
        association === undefined
          ? atom.characterClass
          : association.reading.kind === "jukugo"
            ? "cl-23"
            : "cl-22",
      advanceEm: atom.boxAdvanceEm,
      renderOffsetEm: atom.renderOffsetEm,
      sourceGap: sourceLine.suppressedIndexes.has(index),
    };
  });
  const readingIndex = RubyLineLayout.index(sourceLine.candidateReadings);
  const groupByIndex = new Map(
    sourceLine.groupReadings.flatMap((group) =>
      group.association.indexes.map((index) => [index, group] as const),
    ),
  );
  const resolvedRuby = new WeakMap<readonly BoxAdjustment[], readonly RubyLinePlacement[]>();
  const plans = layoutParagraph(
    paragraph.elements,
    settings.flow.lineLengthEm,
    (start, end, cursor) => {
      if (sourceLine.candidateReadings.length === 0 && sourceLine.groupReadings.length === 0)
        return paragraph.resolveCandidate(start, end);
      const effectiveEnd = nextVisible[end] === characters.length ? characters.length : end;
      const groups = new Set<GroupRubyAllocation>();
      for (let index = start; index < effectiveEnd; index += 1) {
        const group = groupByIndex.get(index);
        if (group !== undefined) groups.add(group);
      }
      const assigned: RubyLineSegment[] = [];
      let nextCursor = cursor;
      for (const group of groups) {
        const allocation = GroupRubyAllocation.assign(
          group,
          start,
          effectiveEnd,
          nextCursor,
          settings.flow.lineLengthEm,
        );
        const physical = allocation.segment;
        const first = sourceLine.atoms[Math.max(physical.start, nextVisible[start] ?? start)];
        const last = sourceLine.atoms[Math.min(physical.end, end) - 1];
        if (first === undefined || last === undefined) return undefined;
        const firstRun = first.combineRun ? sourceLine.runs[first.runIndex] : undefined;
        const lastRun = last.combineRun ? sourceLine.runs[last.runIndex] : undefined;
        const globalStart = sourceLine.atoms[0]?.grapheme.range.graphemes.start ?? 0;
        assigned.push({
          ...physical,
          start:
            firstRun === undefined
              ? Math.max(physical.start, nextVisible[start] ?? start)
              : firstRun.range.graphemes.start - globalStart,
          end:
            lastRun === undefined
              ? Math.min(physical.end, end)
              : lastRun.range.graphemes.end - globalStart,
        });
        nextCursor = allocation.nextCursor;
      }
      const result = RubyLineLayout.resolve(
        rubyBases,
        readingIndex,
        start,
        end,
        (metrics) => paragraph.resolveCandidate(start, end, metrics),
        assigned,
      );
      if (result === undefined) return undefined;
      if (result.line.boxAdjustments !== undefined)
        resolvedRuby.set(result.line.boxAdjustments, result.placements);
      return { ...result.line, nextCursor };
    },
    (left, right) =>
      (right === left + 1 ? boundaries[right] : acrossGaps[left])?.break.kind !== "prohibited",
  );
  const lines: NovelLine[] = [];
  for (const plan of plans) {
    const line = positionedLine(sourceLine.atoms, sourceLine.suppressedIndexes, plan);
    if (line === undefined) return undefined;
    lines.push(line);
  }

  const annotated: NovelLine[] = [];
  for (const [index, line] of lines.entries()) {
    const plan = plans[index];
    const fragments = annotationFragments(
      line.items.filter(PositionedInlineItem.isRenderUnit),
      line.items.filter((item) => item.kind === "suppressed"),
      line.items.flatMap((item) =>
        item.kind === "glue" && item.origin === "source" ? [item] : [],
      ),
      annotations,
      plan?.boxAdjustments === undefined ? [] : (resolvedRuby.get(plan.boxAdjustments) ?? []),
    );
    if (fragments === undefined) return undefined;
    annotated.push({ ...line, annotations: fragments });
  }
  return annotated;
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

function createCompose(provider: RunMeasurer) {
  return (
    manuscript: ParsedManuscript,
    settings: NovelCompositionSettings,
  ): ManuscriptResult<NovelLayout, { reason: string }> => {
    const measurements = MeasurementSession.create(provider, settings);
    const sourceLines = displayedLines(manuscript.graphemes);
    const measured = sourceLines.map((line) =>
      measureSourceLine(line, manuscript.annotations, measurements),
    );
    if (measured.some((line) => line === undefined)) {
      return ManuscriptResult.fail({
        reason: "run measurer returned invalid metrics or cluster mappings",
      });
    }

    const manuscriptLines: NovelLine[] = [];
    for (const line of measured) {
      if (line === undefined) continue;
      const wrapped = wrapSourceLine(line, manuscript.annotations, settings);
      if (wrapped === undefined)
        return ManuscriptResult.fail({
          reason:
            "render units or reading clusters cannot be placed without splitting or collision",
        });
      manuscriptLines.push(...wrapped);
    }
    if (!NovelSourceContract.matches(manuscript, manuscriptLines)) {
      return ManuscriptResult.fail({
        reason: "composition did not preserve source members or ruby readings",
      });
    }
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
  options: Readonly<{ measurer: RunMeasurer }>,
): ManuscriptComposer<NovelCompositionSettings, NovelLayout> {
  return {
    id: COMPOSER_ID,
    settingsSchema: NovelCompositionSettings.schema,
    layoutSchema: NovelLayoutContract.schema,
    compose: createCompose(options.measurer),
  };
}

export const novelComposer = createNovelComposer({ measurer: logicalRunMeasurer });
