import { composeManuscript, FontPreset, ManuscriptRange } from "@sushichan044/kg-core";
import type {
  SingleGlyphUnit,
  AnnotationPlacement,
  ComposedAnnotationFragment,
  DiagnosticSeverity,
  ManuscriptDiagnostic,
  NovelComposedManuscript,
  NovelLine,
  NovelPage as ComposedNovelPage,
  PresentationKind,
} from "@sushichan044/kg-core";
import {
  Suspense,
  use,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { CSSProperties, Ref, RefCallback, RefObject, ReactNode } from "react";

import { DiagnosticHover } from "./DiagnosticHover";
import { DiagnosticMarker } from "./DiagnosticMarker";
import { fitZoom } from "./fit-zoom";
import type { ReadyTypography } from "./typography";
import { cssFontFeatures } from "./typography-profile";
import { TypographyContext, TypographyProvider } from "./TypographyProvider";
import { TypographyLoading, TypographyStatus } from "./TypographyStatus";
import { useTypography } from "./use-typography";

const NO_DIAGNOSTICS: readonly ManuscriptDiagnostic[] = [];
const DEFAULT_ZOOM = { value: 100, min: 1, max: Number.MAX_SAFE_INTEGER, step: 1 } satisfies Omit<
  NovelViewerZoom,
  "onChange"
>;

export type NovelViewerProps = Readonly<{
  composed: NovelComposedManuscript;
  typography?: ReadyTypography;
  diagnostics?: readonly ManuscriptDiagnostic[];
  activeDiagnosticId?: string | null;
  zoom?: NovelViewerZoom;
  fit?: boolean;
  showGrid?: boolean;
  spread?: boolean;
  startPageSide?: "left" | "right";
  ariaLabel?: string;
  className?: string;
  onViewEvent?: (event: NovelViewEvent) => void;
  onDiagnosticSelect?: (diagnostic: ManuscriptDiagnostic) => void;
  ref?: Ref<NovelViewHandle>;
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
  "--kgv-stage-gap": string;
  "--kgv-margin-top": string;
  "--kgv-margin-bottom": string;
  "--kgv-margin-inner": string;
  "--kgv-margin-outer": string;
  "--kgv-manuscript-font": string;
  "--kgv-font-features": string;
  "--kgv-western-kerning": string;
  "--kgv-font-synthesis": string;
  "--kgv-page-height": string;
  "--kgv-page-width": string;
  "--kgv-folio-top": string;
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

function pageText(page: ComposedNovelPage): string {
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
        // 圏点そのものは、ここではなく下のレイヤーが配置する。
        // text-emphasis は圏点の空きを文字自身のボックスの内側に確保し、
        // そのボックスのどこに置くかはエンジンごとに異なる。そのため文字がこまからずれてしまう。
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
  let spanStart = Number.POSITIVE_INFINITY;
  let spanEnd = Number.NEGATIVE_INFINITY;
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
      for (const source of item.sources) {
        const ranges = source.kind === "exact" ? [source.range] : source.ranges;
        for (const { graphemes } of ranges) {
          spanStart = Math.min(spanStart, graphemes.start);
          spanEnd = Math.max(spanEnd, graphemes.end);
        }
        anchors.push({
          ranges,
          offsetEm: source.layoutSpan.offsetEm,
          advanceEm: source.layoutSpan.advanceEm,
          cell,
        });
      }
    } else if (item.kind === "glue" && item.origin === "source") {
      spanStart = Math.min(spanStart, item.range.graphemes.start);
      spanEnd = Math.max(spanEnd, item.range.graphemes.end);
      anchors.push({
        ranges: [item.range],
        offsetEm: item.offsetEm,
        advanceEm: item.widthEm,
        cell: undefined,
      });
    }
  }
  const placed = diagnostics.flatMap((diagnostic): PlacedBand[] => {
    // 行のどのアンカーとも重なりえない診断は、アンカーを調べるまでもなく除く。
    // ManuscriptRange.overlaps と同じ graphemes 座標で比べるので、結果は変わらない。
    if (!(diagnostic.range.graphemes.start < spanEnd && diagnostic.range.graphemes.end > spanStart))
      return [];
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

function renderPages(
  pages: NovelComposedManuscript["layout"]["pages"],
  diagnostics: readonly ManuscriptDiagnostic[],
) {
  return pages.map((page, pageIndex) => {
    const diagnosticIds = new Set<string>();
    const stages = page.stages.map((stage, stageIndex) => ({
      id: `page:${pageIndex}:stage:${stageIndex}`,
      lines: stage.lines.map((line, lineIndex) => {
        const { bands, cells } = lineDiagnostics(line, diagnostics);
        for (const { diagnostic } of bands) diagnosticIds.add(diagnostic.id);
        return {
          id: `page:${pageIndex}:stage:${stageIndex}:line:${lineIndex}`,
          bands,
          cells,
          marks: emphasisMarks(line),
          line,
        };
      }),
    }));
    return { id: `page:${pageIndex}`, page, pageIndex, diagnosticIds, stages };
  });
}

type RenderedPage = ReturnType<typeof renderPages>[number];

// React Compiler はフックの戻り値を変更されない値として扱う。フックを通さないと、
// ページの一覧を作る処理が描画のスコープにまとめられ、拡大率や選択中の診断が変わるたびに作り直される。
function useRenderedPages(
  pages: NovelComposedManuscript["layout"]["pages"],
  diagnostics: readonly ManuscriptDiagnostic[],
) {
  // フックを呼ばないフックは、指示しないとコンパイルの対象にならない。
  "use memo";
  return renderPages(pages, diagnostics);
}

// 指定されたページへ移動する。ページの要素がまだ無ければ、描画されるまで保留する。
function scrollPageIntoView(
  index: number,
  pageCount: number,
  refs: Readonly<{
    pages: RefObject<Array<HTMLElement | null>>;
    pending: RefObject<number | null>;
    visible: RefObject<number>;
  }>,
): void {
  const target = Math.min(Math.max(Math.trunc(index), 0), pageCount - 1);
  refs.visible.current = target;
  const page = refs.pages.current[target];
  if (page === null || page === undefined) refs.pending.current = target;
  else {
    refs.pending.current = null;
    page.scrollIntoView({ block: "start" });
  }
}

type NovelPageProps = Readonly<{
  renderedPage: RenderedPage;
  pageCount: number;
  pageSide: "left" | "right";
  gridRow: number | undefined;
  showGrid: boolean;
  ruleCellCount: number;
  activeDiagnosticId: string | null;
  container: RefObject<HTMLDivElement | null>;
  registerPage: (pageIndex: number, element: HTMLElement | null) => void;
  registerDiagnostic: (id: string, element: HTMLButtonElement | null) => void;
  onDiagnosticSelect: ((diagnostic: ManuscriptDiagnostic) => void) | undefined;
}>;

function NovelPage({
  renderedPage: { page, pageIndex, stages },
  pageCount,
  pageSide,
  gridRow,
  showGrid,
  ruleCellCount,
  activeDiagnosticId,
  container,
  registerPage,
  registerDiagnostic,
  onDiagnosticSelect,
}: NovelPageProps) {
  const text = pageText(page);
  const ruleCells = Array.from({ length: ruleCellCount }, (_, index) => (
    <span key={index} className="kgv-rule-cell" />
  ));

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
    const register: RefCallback<HTMLButtonElement> = (element) => {
      registerDiagnostic(diagnostic.id, element);
    };

    return (
      <span key={diagnostic.id}>
        <span
          className="kgv-diagnostic-band"
          data-diagnostic-id={diagnostic.id}
          data-diagnostic-severity={diagnostic.severity}
          data-diagnostic-active={active ? "" : undefined}
          data-diagnostic-continued={startsHere ? undefined : ""}
          style={bandStyle}
          aria-hidden="true"
        />
        {startsHere ? (
          <DiagnosticMarker
            diagnostic={diagnostic}
            container={container}
            style={bandStyle}
            register={register}
            onSelect={onDiagnosticSelect}
          />
        ) : null}
      </span>
    );
  };

  return (
    <section
      ref={(element) => {
        registerPage(pageIndex, element);
      }}
      data-page-index={pageIndex}
      data-page-side={pageSide}
      style={gridRow === undefined ? undefined : { gridRow }}
      data-grid={showGrid ? "visible" : "hidden"}
      className="kgv-page"
      aria-label={`${pageIndex + 1}ページ目、全${pageCount}ページ`}
      data-offscreen={pageIndex > 0 ? "" : undefined}
    >
      <p className="kgv-visually-hidden">{text}</p>
      <span className="kgv-folio" aria-hidden="true">
        {pageIndex + 1}
      </span>
      <div className="kgv-page-grid">
        {stages.map((stage) => (
          <div key={stage.id} className="kgv-stage">
            {stage.lines.map(({ id: lineId, bands, cells, marks, line }) => {
              return (
                <div key={lineId} className="kgv-line">
                  {showGrid ? (
                    <span className="kgv-line-rules" aria-hidden="true">
                      {ruleCells}
                    </span>
                  ) : null}
                  <span className="kgv-line-text" aria-hidden="true">
                    {cells.map((cell) => {
                      const found = cell.diagnostics;
                      const active = found.some(({ id }) => id === activeDiagnosticId);
                      const content = (
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
                              lang={cell.presentation === "sideways" ? "en" : "ja"}
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
                      return found.length > 0 ? (
                        <DiagnosticHover
                          key={cell.range.graphemes.start}
                          diagnostics={found}
                          container={container}
                        >
                          {content}
                        </DiagnosticHover>
                      ) : (
                        content
                      );
                    })}
                  </span>
                  <span className="kgv-line-ruby" aria-hidden="true">
                    {line.annotations
                      .filter((annotation) => annotation.kind === "ruby")
                      .map(renderRuby)}
                  </span>
                  {marks.length > 0 ? (
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
                  ) : null}
                  {bands.length > 0 ? (
                    <span className="kgv-line-diagnostics">{bands.map(renderBand)}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function NovelViewerRenderer({
  ref,
  composed,
  typography,
  diagnostics = NO_DIAGNOSTICS,
  activeDiagnosticId = null,
  zoom,
  fit = false,
  showGrid = true,
  spread = false,
  startPageSide = "right",
  ariaLabel = "小説プレビュー",
  className,
  onViewEvent,
  onDiagnosticSelect,
}: NovelViewerProps) {
  const { pages, geometry } = composed.layout;
  const rootRef = useRef<HTMLDivElement>(null);
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
  const usesTypography = typography !== undefined;
  const fontFamily = usesTypography ? typography.fontFamily : selectedFont.family;
  const onFitChange = useEffectEvent((percent: number) => {
    onChange(percent);
  });
  const emitViewEvent = useEffectEvent((event: NovelViewEvent) => {
    onViewEvent?.(event);
  });

  useImperativeHandle(
    ref,
    () => ({
      scrollToPage: (index: number) => {
        scrollPageIntoView(index, pages.length, {
          pages: pageRefs,
          pending: pendingPageRef,
          visible: visiblePageRef,
        });
      },
      scrollToDiagnostic: (id: string) => {
        diagnosticRefs.current.get(id)?.scrollIntoView({ block: "center", inline: "center" });
      },
      getVisiblePage: () => visiblePageRef.current,
    }),
    [pages.length],
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
      onFitChange(
        fitZoom({
          viewportWidthPx: width,
          viewportHeightPx: height,
          paperWidthMm: geometry.paperWidthMm * (spread ? 2 : 1),
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
  }, [fit, geometry.paperHeightMm, geometry.paperWidthMm, max, min, spread, step]);

  useEffect(() => {
    const pending = pendingPageRef.current;
    if (pending === null) return;
    scrollPageIntoView(pending, pages.length, {
      pages: pageRefs,
      pending: pendingPageRef,
      visible: visiblePageRef,
    });
  }, [pages]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let visible: IntersectionObserverEntry | undefined;
        for (const entry of entries) {
          if (
            entry.isIntersecting &&
            (visible === undefined || entry.intersectionRatio > visible.intersectionRatio)
          )
            visible = entry;
        }
        if (visible !== undefined) {
          const page = Number(visible.target.getAttribute("data-page-index"));
          visiblePageRef.current = page;
          emitViewEvent({ kind: "visible-page.change", page });
        }
      },
      { root: viewport, threshold: [0.25, 0.5, 0.75] },
    );
    for (const page of pageRefs.current) if (page !== null) observer.observe(page);
    return () => {
      observer.disconnect();
    };
  }, [pages]);

  useEffect(() => {
    if (activeDiagnosticId === null) return;
    diagnosticRefs.current
      .get(activeDiagnosticId)
      ?.scrollIntoView({ block: "center", inline: "center" });
  }, [activeDiagnosticId, pages]);

  const style: NovelStyle = {
    "--kgv-cell-size": `${geometry.cellSizeMm * (value / 100)}mm`,
    "--kgv-line-gap": `${geometry.lineGapMm * (value / 100)}mm`,
    "--kgv-line-length": composed.settings.flow.lineLengthEm,
    "--kgv-stage-gap": `${geometry.stageGapMm * (value / 100)}mm`,
    "--kgv-margin-top": `${geometry.topMm * (value / 100)}mm`,
    "--kgv-margin-bottom": `${geometry.bottomMm * (value / 100)}mm`,
    "--kgv-margin-inner": `${geometry.innerMm * (value / 100)}mm`,
    "--kgv-margin-outer": `${geometry.outerMm * (value / 100)}mm`,
    "--kgv-manuscript-font": fontFamily,
    "--kgv-font-features": cssFontFeatures(selectedFont),
    "--kgv-western-kerning": selectedFont.rendering.westernKerning,
    "--kgv-font-synthesis": selectedFont.rendering.synthesis,
    "--kgv-page-height": `${geometry.paperHeightMm * (value / 100)}mm`,
    "--kgv-page-width": `${geometry.paperWidthMm * (value / 100)}mm`,
    "--kgv-folio-top": `${10 * (value / 100)}mm`,
  };
  const renderedPages = useRenderedPages(pages, diagnostics);
  const ruleCellCount = Math.ceil(composed.settings.flow.lineLengthEm);
  const registerPage = (pageIndex: number, element: HTMLElement | null) => {
    pageRefs.current[pageIndex] = element;
  };
  const registerDiagnostic = (id: string, element: HTMLButtonElement | null) => {
    if (element === null) diagnosticRefs.current.delete(id);
    else diagnosticRefs.current.set(id, element);
  };

  return (
    <div
      ref={rootRef}
      className={joinClassNames("kgv-viewer", className)}
      aria-label={ariaLabel}
      lang="ja"
      data-typography={usesTypography ? selectedFont.id : undefined}
    >
      <div ref={viewportRef} className="kgv-viewport">
        <div className="kgv-stack" data-spread={spread ? "" : undefined} style={style}>
          {renderedPages.map((renderedPage) => {
            const { id, pageIndex, diagnosticIds } = renderedPage;
            return (
              <NovelPage
                key={id}
                renderedPage={renderedPage}
                pageCount={pages.length}
                pageSide={
                  pageIndex % 2 === 0 ? startPageSide : startPageSide === "right" ? "left" : "right"
                }
                gridRow={
                  spread
                    ? Math.floor((pageIndex + (startPageSide === "left" ? 1 : 0)) / 2) + 1
                    : undefined
                }
                showGrid={showGrid}
                ruleCellCount={ruleCellCount}
                activeDiagnosticId={
                  activeDiagnosticId !== null && diagnosticIds.has(activeDiagnosticId)
                    ? activeDiagnosticId
                    : null
                }
                container={rootRef}
                registerPage={registerPage}
                registerDiagnostic={registerDiagnostic}
                onDiagnosticSelect={onDiagnosticSelect}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 診断だけが変わったときに組版をやり直さないよう、フックの戻り値として診断の変換と別のスコープに分ける
function useMeasuredComposition(
  parsed: NovelComposedManuscript["parsed"],
  settings: NovelComposedManuscript["settings"],
  typography: ReadyTypography,
) {
  "use memo";
  const prepared = typography.prepare(parsed);
  const composed = composeManuscript(prepared.parsed, {
    composer: typography.composer,
    settings,
  });
  return { prepared, composed };
}

function MeasuredNovelViewer(props: NovelViewerProps) {
  const state = useTypography(props.composed.settings.appearance.fontPreset);
  if (state.kind === "failed") return <TypographyStatus state={state} />;
  return <ComposedNovelViewer {...props} typography={state.typography} />;
}

function ComposedNovelViewer({
  typography,
  ...props
}: NovelViewerProps & Readonly<{ typography: ReadyTypography }>) {
  const { prepared, composed } = useMeasuredComposition(
    props.composed.parsed,
    props.composed.settings,
    typography,
  );
  if (!composed.ok) return <p role="alert">原稿を組版できませんでした。</p>;
  const diagnostics = props.diagnostics?.map((diagnostic) => ({
    ...diagnostic,
    range: prepared.mapRange(diagnostic.range),
  }));
  return (
    <NovelViewerRenderer
      {...props}
      composed={composed.value}
      typography={typography}
      diagnostics={diagnostics}
    />
  );
}

function AutomaticNovelViewer(props: NovelViewerProps) {
  const cache = use(TypographyContext);
  const viewer = (
    <Suspense fallback={<TypographyLoading />}>
      <MeasuredNovelViewer {...props} />
    </Suspense>
  );
  // 自前のキャッシュは書体を切り替えたときに作り直し、使わなくなった書体をすぐ解放する
  return cache === null ? (
    <TypographyProvider key={props.composed.settings.appearance.fontPreset}>
      {viewer}
    </TypographyProvider>
  ) : (
    viewer
  );
}

export function NovelViewer(props: NovelViewerProps) {
  const fontPreset = props.composed.settings.appearance.fontPreset;
  if (props.typography !== undefined && props.typography.fontPreset !== fontPreset)
    return <p role="alert">書体と組版設定が一致しません。</p>;
  if (props.typography !== undefined || FontPreset.of(fontPreset).measurement === "logical")
    return <NovelViewerRenderer {...props} />;
  return <AutomaticNovelViewer {...props} />;
}
