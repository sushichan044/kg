import { FontPreset, ManuscriptRange } from "@sushichan044/kg-core";
import type {
  SingleGlyphUnit,
  AnnotationPlacement,
  ComposedAnnotationFragment,
  DiagnosticSeverity,
  ManuscriptDiagnostic,
  NovelComposedManuscript,
  NovelLine,
  NovelPage,
  PresentationKind,
} from "@sushichan044/kg-core";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ForwardedRef, ReactNode } from "react";

import { fitZoom } from "./fit-zoom";

const NO_DIAGNOSTICS: readonly ManuscriptDiagnostic[] = [];
const DEFAULT_ZOOM = { value: 100, min: 1, max: Number.MAX_SAFE_INTEGER, step: 1 } satisfies Omit<
  NovelViewerZoom,
  "onChange"
>;

export type NovelViewerProps = Readonly<{
  composed: NovelComposedManuscript;
  diagnostics?: readonly ManuscriptDiagnostic[];
  activeDiagnosticId?: string | null;
  zoom?: NovelViewerZoom;
  fit?: boolean;
  showGrid?: boolean;
  ariaLabel?: string;
  className?: string;
  onViewEvent?: (event: NovelViewEvent) => void;
  onDiagnosticSelect?: (diagnostic: ManuscriptDiagnostic) => void;
}>;

export type NovelViewerZoom = Readonly<{
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}>;

export type NovelViewEvent = Readonly<{ kind: "visible-page.change"; page: number }>;

export type NovelViewHandle = Readonly<{
  scrollToPage: (index: number) => void;
  scrollToDiagnostic: (id: string) => void;
  getVisiblePage: () => number;
}>;

type NovelStyle = CSSProperties & {
  "--kgv-cell-size": string;
  "--kgv-line-gap": string;
  "--kgv-line-length": number;
  "--kgv-manuscript-font": string;
  "--kgv-page-height": string;
  "--kgv-page-width": string;
};

type PositionedStyle = CSSProperties & {
  "--kgv-item-advance": number;
  "--kgv-item-offset": number;
};

type BandStyle = CSSProperties & {
  "--kgv-band-lane": number;
  "--kgv-band-lanes": number;
  "--kgv-band-length": number;
  "--kgv-band-offset": number;
};

function pageText(page: NovelPage): string {
  return page.stages
    .flatMap(({ lines }) =>
      lines.map(({ items }) =>
        items
          .flatMap((item) =>
            item.kind === "glyph" ||
            item.kind === "combined-glyph" ||
            (item.kind === "glue" && item.origin === "source")
              ? [item.value]
              : [],
          )
          .join(""),
      ),
    )
    .join("\n");
}

function graphemeSeverity(
  diagnostics: readonly ManuscriptDiagnostic[],
): DiagnosticSeverity | undefined {
  if (diagnostics.length === 0) return undefined;
  return diagnostics.some(({ severity }) => severity === "error") ? "error" : "warning";
}

function joinClassNames(...names: Array<string | undefined>): string {
  return names.filter((name) => name !== undefined && name !== "").join(" ");
}

function annotationKey(annotation: ComposedAnnotationFragment): string {
  return `${annotation.kind}:${annotation.annotationRange.source.start}:${annotation.annotationRange.source.end}`;
}

function annotationsForRange(
  line: NovelLine,
  range: SingleGlyphUnit["range"],
): readonly ComposedAnnotationFragment[] {
  return line.annotations.filter(
    (annotation) =>
      annotation.kind !== "ruby" && ManuscriptRange.overlaps(annotation.fragmentRange, range),
  );
}

function wrapAnnotations(
  annotations: readonly ComposedAnnotationFragment[],
  children: ReactNode,
): ReactNode {
  return annotations.reduceRight<ReactNode>((wrapped, annotation) => {
    switch (annotation.kind) {
      case "bold": {
        return (
          <strong key={annotationKey(annotation)} data-annotation="bold">
            {wrapped}
          </strong>
        );
      }
      case "italic": {
        return (
          <em key={annotationKey(annotation)} data-annotation="italic">
            {wrapped}
          </em>
        );
      }
      case "emphasis": {
        // The marks themselves are placed by the layer below, not drawn from here: text-emphasis
        // reserves their room inside the character's own box, and engines disagree about where in
        // that box, which moves the character off its cell.
        return (
          <span key={annotationKey(annotation)} data-annotation="emphasis">
            {wrapped}
          </span>
        );
      }
      case "ruby": {
        return wrapped;
      }
    }
  }, children);
}

type DiagnosticBand = Readonly<{
  diagnostic: ManuscriptDiagnostic;
  offsetEm: number;
  advanceEm: number;
  lane: number;
  lanes: number;
  startsHere: boolean;
}>;

type PlacedBand = Omit<DiagnosticBand, "lane" | "lanes">;
type RenderedCell = Readonly<{
  value: string;
  range: SingleGlyphUnit["range"];
  offsetEm: number;
  advanceEm: number;
  disposition: SingleGlyphUnit["disposition"];
  presentation: PresentationKind;
  diagnostics: readonly ManuscriptDiagnostic[];
}>;
type EmphasisMark = Readonly<{
  key: string;
  mark: string;
  placement: AnnotationPlacement;
}>;

type DecorationStyle = PositionedStyle & {
  "--kgv-decoration-block-offset": number;
  "--kgv-decoration-block-size": number;
};

function decorationStyle(placement: AnnotationPlacement): DecorationStyle {
  return {
    "--kgv-item-offset": placement.inlineSpan.offsetEm,
    "--kgv-item-advance": placement.inlineSpan.advanceEm,
    "--kgv-decoration-block-offset": placement.blockOffsetEm,
    "--kgv-decoration-block-size": placement.blockSizeEm,
  };
}

function presentationClass(kind: PresentationKind): string | undefined {
  switch (kind) {
    case "mixed": {
      return undefined;
    }
    case "upright": {
      return "kgv-glyph-upright";
    }
    case "sideways": {
      return "kgv-glyph-sideways";
    }
    case "tate-chu-yoko": {
      return "kgv-glyph-tate-chu-yoko";
    }
  }
}

function emphasisMarks(line: NovelLine): EmphasisMark[] {
  return line.annotations.flatMap((annotation) =>
    annotation.kind === "emphasis"
      ? annotation.placements.map((placement, index) => ({
          key: `${annotationKey(annotation)}:${index}`,
          mark: annotation.mark,
          placement,
        }))
      : [],
  );
}

function assignBandLanes(placed: readonly PlacedBand[]): DiagnosticBand[] {
  const groups: PlacedBand[][] = [];
  let group: PlacedBand[] = [];
  let groupEnd = Number.NEGATIVE_INFINITY;

  for (const band of placed) {
    if (group.length > 0 && band.offsetEm >= groupEnd) {
      groups.push(group);
      group = [];
      groupEnd = Number.NEGATIVE_INFINITY;
    }

    group.push(band);
    groupEnd = Math.max(groupEnd, band.offsetEm + band.advanceEm);
  }
  if (group.length > 0) groups.push(group);

  return groups.flatMap((overlapping) => {
    const laneEnds: number[] = [];
    const assigned = overlapping.map((band) => {
      let lane = laneEnds.findIndex((end) => end <= band.offsetEm);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[lane] = band.offsetEm + band.advanceEm;

      return { ...band, lane };
    });

    return assigned.map(({ diagnostic, offsetEm, advanceEm, startsHere, lane }) => ({
      diagnostic,
      offsetEm,
      advanceEm,
      startsHere,
      lane,
      lanes: laneEnds.length,
    }));
  });
}

function lineDiagnostics(
  line: NovelLine,
  diagnostics: readonly ManuscriptDiagnostic[],
): Readonly<{ bands: DiagnosticBand[]; cells: RenderedCell[] }> {
  const cells: RenderedCell[] = [];
  const anchors: Array<
    Readonly<{
      ranges: readonly ManuscriptRange[];
      offsetEm: number;
      advanceEm: number;
      cell: { diagnostics: ManuscriptDiagnostic[] } | undefined;
    }>
  > = [];
  for (const item of line.items) {
    if (item.kind === "glyph" || item.kind === "combined-glyph") {
      const cell = {
        value: item.value,
        range: item.range,
        offsetEm: item.renderSpan.offsetEm,
        advanceEm: item.renderSpan.advanceEm,
        disposition: item.disposition,
        presentation: item.presentation,
        diagnostics: [] as ManuscriptDiagnostic[],
      } satisfies RenderedCell;
      cells.push(cell);
      for (const source of item.sources)
        anchors.push({
          ranges: source.kind === "exact" ? [source.range] : source.ranges,
          offsetEm: source.layoutSpan.offsetEm,
          advanceEm: source.layoutSpan.advanceEm,
          cell,
        });
    } else if (item.kind === "glue" && item.origin === "source") {
      anchors.push({
        ranges: [item.range],
        offsetEm: item.offsetEm,
        advanceEm: item.widthEm,
        cell: undefined,
      });
    }
  }
  const placed = diagnostics.flatMap((diagnostic): PlacedBand[] => {
    const covered = anchors.filter(({ ranges }) =>
      ranges.some((range) => ManuscriptRange.overlaps(range, diagnostic.range)),
    );
    for (const anchor of covered) {
      if (anchor.cell !== undefined && !anchor.cell.diagnostics.includes(diagnostic))
        anchor.cell.diagnostics.push(diagnostic);
    }
    const first = covered[0];
    const last = covered.at(-1);
    if (first === undefined || last === undefined) return [];
    return [
      {
        diagnostic,
        offsetEm: first.offsetEm,
        advanceEm: last.offsetEm + last.advanceEm - first.offsetEm,
        startsHere: first.ranges.some(
          (range) =>
            diagnostic.range.source.start >= range.source.start &&
            diagnostic.range.source.start < range.source.end,
        ),
      },
    ];
  });
  placed.sort((left, right) => left.offsetEm - right.offsetEm || right.advanceEm - left.advanceEm);
  return { bands: assignBandLanes(placed), cells };
}

function renderRuby(annotation: Extract<ComposedAnnotationFragment, { kind: "ruby" }>) {
  return (
    <ruby
      key={annotationKey(annotation)}
      className="kgv-annotation kgv-ruby-fragment"
      data-annotation="ruby"
      data-ruby-fit={annotation.rubyKind}
      aria-hidden="true"
    >
      <span className="kgv-ruby-base-placeholder" />
      <rt>
        <span className="kgv-ruby">
          {annotation.readingItems.map((item) => (
            <span
              key={`${item.textRange.start}:${item.value}`}
              className="kgv-ruby-character"
              data-side={item.placement.side}
              style={decorationStyle(item.placement)}
            >
              {item.value}
            </span>
          ))}
        </span>
      </rt>
    </ruby>
  );
}

function NovelViewerComponent(
  {
    composed,
    diagnostics = NO_DIAGNOSTICS,
    activeDiagnosticId = null,
    zoom,
    fit = false,
    showGrid = true,
    ariaLabel = "小説プレビュー",
    className,
    onViewEvent,
    onDiagnosticSelect,
  }: NovelViewerProps,
  ref: ForwardedRef<NovelViewHandle>,
) {
  const { pages, geometry } = composed.layout;
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Array<HTMLElement | null>>([]);
  const diagnosticRefs = useRef(new Map<string, HTMLElement>());
  const pendingPageRef = useRef<number | null>(null);
  const visiblePageRef = useRef(0);
  const [uncontrolledZoom, setUncontrolledZoom] = useState(DEFAULT_ZOOM.value);
  const { max, min, step } = zoom ?? DEFAULT_ZOOM;
  const value = zoom?.value ?? uncontrolledZoom;
  const onChange = zoom?.onChange ?? setUncontrolledZoom;
  const selectedFont = FontPreset.of(composed.settings.appearance.fontPreset);

  const scrollToPage = useCallback(
    (index: number) => {
      const target = Math.min(Math.max(Math.trunc(index), 0), pages.length - 1);
      visiblePageRef.current = target;
      const page = pageRefs.current[target];
      if (page === null || page === undefined) pendingPageRef.current = target;
      else {
        pendingPageRef.current = null;
        page.scrollIntoView({ block: "start" });
      }
    },
    [pages.length],
  );
  const scrollToDiagnostic = useCallback((id: string) => {
    diagnosticRefs.current.get(id)?.scrollIntoView({ block: "center", inline: "center" });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      scrollToPage,
      scrollToDiagnostic,
      getVisiblePage: () => visiblePageRef.current,
    }),
    [scrollToDiagnostic, scrollToPage],
  );

  useEffect(() => {
    if (!fit) return;
    const viewport = viewportRef.current;
    if (viewport === null) return;
    const updateFitPercent = () => {
      const viewportStyle = getComputedStyle(viewport);
      const width =
        viewport.clientWidth -
        Number.parseFloat(viewportStyle.paddingInlineStart) -
        Number.parseFloat(viewportStyle.paddingInlineEnd);
      const height =
        viewport.clientHeight -
        Number.parseFloat(viewportStyle.paddingBlockStart) -
        Number.parseFloat(viewportStyle.paddingBlockEnd);
      onChange(
        fitZoom({
          viewportWidthPx: width,
          viewportHeightPx: height,
          paperWidthMm: geometry.paperWidthMm,
          paperHeightMm: geometry.paperHeightMm,
          min,
          max,
          step,
        }),
      );
    };
    updateFitPercent();
    const observer = new ResizeObserver(updateFitPercent);
    observer.observe(viewport);
    return () => {
      observer.disconnect();
    };
  }, [fit, geometry.paperHeightMm, geometry.paperWidthMm, max, min, onChange, step]);

  useEffect(() => {
    if (pendingPageRef.current !== null) scrollToPage(pendingPageRef.current);
  }, [pages, scrollToPage]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visible !== undefined) {
          const page = Number(visible.target.getAttribute("data-page-index"));
          visiblePageRef.current = page;
          onViewEvent?.({ kind: "visible-page.change", page });
        }
      },
      { root: viewport, threshold: [0.25, 0.5, 0.75] },
    );
    for (const page of pageRefs.current) if (page !== null) observer.observe(page);
    return () => {
      observer.disconnect();
    };
  }, [onViewEvent, pages]);

  useEffect(() => {
    if (activeDiagnosticId !== null) scrollToDiagnostic(activeDiagnosticId);
  }, [activeDiagnosticId, pages, scrollToDiagnostic]);

  const style: NovelStyle = useMemo(
    () => ({
      "--kgv-cell-size": `${geometry.cellSizeMm * (value / 100)}mm`,
      "--kgv-line-gap": `${geometry.lineGapMm * (value / 100)}mm`,
      "--kgv-line-length": composed.settings.flow.lineLengthEm,
      "--kgv-manuscript-font": selectedFont.family,
      "--kgv-page-height": `${geometry.paperHeightMm * (value / 100)}mm`,
      "--kgv-page-width": `${geometry.paperWidthMm * (value / 100)}mm`,
    }),
    [composed.settings.flow.lineLengthEm, geometry, selectedFont.family, value],
  );
  const renderedPages = useMemo(
    () =>
      pages.map((page, pageIndex) => ({
        id: `page:${pageIndex}`,
        page,
        pageIndex,
        stages: page.stages.map((stage, stageIndex) => ({
          id: `page:${pageIndex}:stage:${stageIndex}`,
          lines: stage.lines.map((line, lineIndex) => {
            const { bands, cells } = lineDiagnostics(line, diagnostics);
            return {
              id: `page:${pageIndex}:stage:${stageIndex}:line:${lineIndex}`,
              bands,
              cells,
              marks: emphasisMarks(line),
              line,
            };
          }),
        })),
      })),
    [diagnostics, pages],
  );

  const renderBand = ({
    diagnostic,
    offsetEm,
    advanceEm,
    lane,
    lanes,
    startsHere,
  }: DiagnosticBand) => {
    const bandStyle: BandStyle = {
      "--kgv-band-lane": lane,
      "--kgv-band-lanes": lanes,
      "--kgv-band-length": advanceEm,
      "--kgv-band-offset": offsetEm,
    };
    const active = diagnostic.id === activeDiagnosticId;

    if (!startsHere) {
      return (
        <span
          key={diagnostic.id}
          className="kgv-diagnostic-band"
          data-diagnostic-id={diagnostic.id}
          data-diagnostic-severity={diagnostic.severity}
          data-diagnostic-active={active ? "" : undefined}
          data-diagnostic-continued=""
          style={bandStyle}
          aria-hidden="true"
        />
      );
    }

    return (
      <button
        key={diagnostic.id}
        ref={(element) => {
          if (element === null) diagnosticRefs.current.delete(diagnostic.id);
          else diagnosticRefs.current.set(diagnostic.id, element);
        }}
        type="button"
        className="kgv-diagnostic-band"
        data-diagnostic-id={diagnostic.id}
        data-diagnostic-severity={diagnostic.severity}
        data-diagnostic-active={active ? "" : undefined}
        style={bandStyle}
        aria-label={`${diagnostic.location.start.line}行${diagnostic.location.start.column}列: ${diagnostic.message}`}
        onClick={() => onDiagnosticSelect?.(diagnostic)}
      />
    );
  };

  return (
    <div className={joinClassNames("kgv-viewer", className)} aria-label={ariaLabel}>
      <div ref={viewportRef} className="kgv-viewport">
        <div className="kgv-stack" style={style}>
          {renderedPages.map(({ id, page, pageIndex, stages }) => (
            <section
              key={id}
              ref={(element) => {
                pageRefs.current[pageIndex] = element;
              }}
              data-page-index={pageIndex}
              data-grid={showGrid ? "visible" : "hidden"}
              className="kgv-page"
              aria-label={`${pageIndex + 1}ページ目、全${pages.length}ページ`}
              data-offscreen={pageIndex > 0 ? "" : undefined}
              data-overflow={geometry.fitsPaper ? undefined : ""}
            >
              <p className="kgv-visually-hidden">{pageText(page)}</p>
              <div className="kgv-page-grid">
                {stages.map((stage) => (
                  <div key={stage.id} className="kgv-stage">
                    {stage.lines.map(({ id: lineId, bands, cells, marks, line }) => {
                      return (
                        <div key={lineId} className="kgv-line">
                          {showGrid && (
                            <span className="kgv-line-rules" aria-hidden="true">
                              {Array.from(
                                { length: Math.ceil(composed.settings.flow.lineLengthEm) },
                                (_, index) => (
                                  <span key={index} className="kgv-rule-cell" />
                                ),
                              )}
                            </span>
                          )}
                          <span className="kgv-line-text" aria-hidden="true">
                            {cells.map((cell) => {
                              const found = cell.diagnostics;
                              const active = found.some(({ id }) => id === activeDiagnosticId);
                              return (
                                <span
                                  key={cell.range.graphemes.start}
                                  className="kgv-cell"
                                  data-disposition={cell.disposition}
                                  data-presentation={cell.presentation}
                                  data-diagnostic={found.length > 0 ? "" : undefined}
                                  data-diagnostic-active={active ? "" : undefined}
                                  data-diagnostic-severity={graphemeSeverity(found)}
                                  style={
                                    {
                                      "--kgv-item-offset": cell.offsetEm,
                                      "--kgv-item-advance": cell.advanceEm,
                                    } as PositionedStyle
                                  }
                                >
                                  {wrapAnnotations(
                                    annotationsForRange(line, cell.range),
                                    <span
                                      className={joinClassNames(
                                        "kgv-glyph",
                                        presentationClass(cell.presentation),
                                      )}
                                    >
                                      {cell.value}
                                    </span>,
                                  )}
                                </span>
                              );
                            })}
                          </span>
                          <span className="kgv-line-ruby" aria-hidden="true">
                            {line.annotations
                              .filter((annotation) => annotation.kind === "ruby")
                              .map(renderRuby)}
                          </span>
                          {marks.length > 0 && (
                            <span className="kgv-line-emphasis" aria-hidden="true">
                              <span className="kgv-emphasis">
                                {marks.map(({ key, mark, placement }) => (
                                  <span
                                    key={key}
                                    className="kgv-emphasis-mark"
                                    data-side={placement.side}
                                    style={decorationStyle(placement)}
                                  >
                                    {mark}
                                  </span>
                                ))}
                              </span>
                            </span>
                          )}
                          {bands.length > 0 && (
                            <span className="kgv-line-diagnostics">{bands.map(renderBand)}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export const NovelViewer = forwardRef(NovelViewerComponent);
