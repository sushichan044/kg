import { FontPreset, ManuscriptRange } from "@sushichan044/kg-core";
import type {
  ComposedAnnotationFragment,
  DiagnosticSeverity,
  ManuscriptDiagnostic,
  NovelComposedManuscript,
  NovelLine,
  NovelPage,
  PositionedGrapheme,
  VerticalTextPresentation,
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
      lines.map(({ graphemes }) => graphemes.map(({ value }) => value).join("")),
    )
    .join("\n");
}

function covers(grapheme: PositionedGrapheme, diagnostic: ManuscriptDiagnostic): boolean {
  return ManuscriptRange.overlaps(grapheme.range, diagnostic.range);
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

function cssString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function annotationKey(annotation: ComposedAnnotationFragment): string {
  return `${annotation.kind}:${annotation.annotationRange.source.start}:${annotation.annotationRange.source.end}`;
}

function annotationsForRange(
  line: NovelLine,
  range: PositionedGrapheme["range"],
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
        return (
          <span
            key={annotationKey(annotation)}
            data-annotation="emphasis"
            style={{ textEmphasis: cssString(annotation.mark) }}
          >
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
type RenderedGrapheme = Readonly<{
  grapheme: PositionedGrapheme;
  diagnostics: readonly ManuscriptDiagnostic[];
}>;
type RenderedCell = Readonly<{
  value: string;
  range: PositionedGrapheme["range"];
  offsetEm: number;
  advanceEm: number;
  disposition: PositionedGrapheme["disposition"];
  presentation: VerticalTextPresentation["kind"];
  diagnostics: readonly ManuscriptDiagnostic[];
}>;

function samePresentationGroup(left: PositionedGrapheme, right: PositionedGrapheme): boolean {
  return (
    left.presentation.kind === right.presentation.kind &&
    left.presentation.groupRange.graphemes.start ===
      right.presentation.groupRange.graphemes.start &&
    left.presentation.groupRange.graphemes.end === right.presentation.groupRange.graphemes.end
  );
}

function renderedCells(graphemes: readonly RenderedGrapheme[]): RenderedCell[] {
  const groups: RenderedGrapheme[][] = [];
  for (const entry of graphemes) {
    const previous = groups.at(-1);
    const first = previous?.[0];
    if (
      entry.grapheme.presentation.kind === "tate-chu-yoko" &&
      previous !== undefined &&
      first !== undefined &&
      samePresentationGroup(first.grapheme, entry.grapheme)
    ) {
      previous.push(entry);
    } else {
      groups.push([entry]);
    }
  }

  return groups.flatMap((group): RenderedCell[] => {
    const first = group[0];
    const last = group.at(-1);
    if (first === undefined || last === undefined) return [];
    const combinesPresentation = first.grapheme.presentation.kind === "tate-chu-yoko";
    const diagnostics = new Map<string, ManuscriptDiagnostic>();
    for (const entry of group) {
      for (const diagnostic of entry.diagnostics) diagnostics.set(diagnostic.id, diagnostic);
    }

    return [
      {
        value: group.map(({ grapheme }) => grapheme.value).join(""),
        range: combinesPresentation ? first.grapheme.presentation.groupRange : first.grapheme.range,
        offsetEm: first.grapheme.offsetEm,
        advanceEm: last.grapheme.offsetEm + last.grapheme.advanceEm - first.grapheme.offsetEm,
        disposition: group.some(({ grapheme }) => grapheme.disposition === "hanging")
          ? "hanging"
          : "placed",
        presentation: first.grapheme.presentation.kind,
        diagnostics: [...diagnostics.values()],
      },
    ];
  });
}

function presentationClass(kind: VerticalTextPresentation["kind"]): string | undefined {
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
): Readonly<{ bands: DiagnosticBand[]; graphemes: RenderedGrapheme[] }> {
  const graphemes = line.graphemes.map((grapheme) => ({
    grapheme,
    diagnostics: [] as ManuscriptDiagnostic[],
  }));
  const placed = diagnostics.flatMap((diagnostic): PlacedBand[] => {
    const covered = graphemes.filter(({ grapheme }) => covers(grapheme, diagnostic));
    for (const entry of covered) entry.diagnostics.push(diagnostic);
    const first = covered[0];
    const last = covered.at(-1);
    if (first === undefined || last === undefined) return [];

    return [
      {
        diagnostic,
        offsetEm: first.grapheme.offsetEm,
        advanceEm: last.grapheme.offsetEm + last.grapheme.advanceEm - first.grapheme.offsetEm,
        startsHere:
          diagnostic.range.source.start >= first.grapheme.range.source.start &&
          diagnostic.range.source.start < first.grapheme.range.source.end,
      },
    ];
  });
  placed.sort((left, right) => left.offsetEm - right.offsetEm || right.advanceEm - left.advanceEm);

  return { bands: assignBandLanes(placed), graphemes };
}

function renderRuby(annotation: Extract<ComposedAnnotationFragment, { kind: "ruby" }>) {
  return (
    <ruby
      key={annotationKey(annotation)}
      className="kgv-annotation kgv-ruby-fragment"
      data-annotation="ruby"
      data-ruby-fit={annotation.rubyKind}
      style={
        {
          "--kgv-item-offset": annotation.baseOffsetEm,
          "--kgv-item-advance": annotation.baseAdvanceEm,
        } as PositionedStyle
      }
      aria-hidden="true"
    >
      <span className="kgv-ruby-base-placeholder" />
      <rt>
        <span className="kgv-ruby">
          {annotation.readingGraphemes.map((grapheme) => (
            <span
              key={`${grapheme.offsetEm}:${grapheme.value}`}
              className="kgv-ruby-character"
              style={
                {
                  "--kgv-item-offset": grapheme.offsetEm,
                  "--kgv-item-advance": grapheme.advanceEm,
                } as PositionedStyle
              }
            >
              {grapheme.value}
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
            const { bands, graphemes } = lineDiagnostics(line, diagnostics);
            return {
              id: `page:${pageIndex}:stage:${stageIndex}:line:${lineIndex}`,
              bands,
              cells: renderedCells(graphemes),
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
                    {stage.lines.map(({ id: lineId, bands, cells, line }) => {
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
