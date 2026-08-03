import { FontPreset } from "@sushichan044/kg-core";
import type {
  GridCell,
  GridComposedManuscript,
  GridPage,
  ManuscriptAnnotation,
  ManuscriptDiagnostic,
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

import { ZoomMode } from "./ZoomMode";

const NO_DIAGNOSTICS: readonly ManuscriptDiagnostic[] = [];

export type ManuscriptViewerProps = Readonly<{
  composed: GridComposedManuscript;
  diagnostics?: readonly ManuscriptDiagnostic[];
  activeDiagnosticId?: string | null;
  zoom?: ZoomMode;
  ariaLabel?: string;
  className?: string;
  onViewEvent?: (event: ManuscriptViewEvent) => void;
  onDiagnosticSelect?: (diagnostic: ManuscriptDiagnostic) => void;
}>;

export type ManuscriptViewEvent =
  | Readonly<{ kind: "visible-page.change"; page: number }>
  | Readonly<{ kind: "effective-zoom.change"; percent: number }>;

export type ManuscriptViewHandle = Readonly<{
  scrollToPage: (index: number) => void;
  scrollToDiagnostic: (id: string) => void;
  getVisiblePage: () => number;
  getEffectiveZoomPercent: () => number;
}>;

type ManuscriptStyle = CSSProperties & {
  "--kgv-cell-size": string;
  "--kgv-line-gap": string;
  "--kgv-manuscript-font": string;
  "--kgv-page-height": string;
  "--kgv-page-width": string;
};

const uprightGlyphPattern = /^(?:\p{Script=Latin}|[0-9])/u;

function pageText(page: GridPage): string {
  return page.stages
    .flatMap(({ lines }) =>
      lines.map(({ cells }) =>
        cells.flatMap(({ value }) => (value === null ? [] : [value])).join(""),
      ),
    )
    .join("\n");
}

function diagnosticsForCell(
  cell: GridCell,
  diagnostics: readonly ManuscriptDiagnostic[],
): ManuscriptDiagnostic[] {
  if (cell.range === null) return [];
  const sourceRange = cell.range.source;
  return diagnostics.filter(
    ({ range }) => range.source.start < sourceRange.end && range.source.end > sourceRange.start,
  );
}

function startsInCell(cell: GridCell, diagnostic: ManuscriptDiagnostic): boolean {
  return (
    cell.range !== null &&
    diagnostic.range.source.start >= cell.range.source.start &&
    diagnostic.range.source.start < cell.range.source.end
  );
}

function joinClassNames(...names: Array<string | undefined>): string {
  return names.filter((name) => name !== undefined && name !== "").join(" ");
}

type RenderedCell = Readonly<{ id: string; cell: GridCell }>;

type CellFragment = Readonly<{
  id: string;
  annotations: readonly ManuscriptAnnotation[];
  cells: RenderedCell[];
}>;

function annotationKey(annotation: ManuscriptAnnotation): string {
  return `${annotation.kind}:${annotation.range.source.start}:${annotation.range.source.end}`;
}

function annotationSetKey(annotations: readonly ManuscriptAnnotation[]): string {
  return annotations.map(annotationKey).join("|");
}

function cssString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function fragmentCells(cells: readonly RenderedCell[]): CellFragment[] {
  const fragments: CellFragment[] = [];
  for (const item of cells) {
    const previous = fragments.at(-1);
    if (
      previous !== undefined &&
      annotationSetKey(previous.annotations) === annotationSetKey(item.cell.annotations)
    ) {
      previous.cells.push(item);
    } else {
      fragments.push({ id: item.id, annotations: item.cell.annotations, cells: [item] });
    }
  }
  return fragments;
}

type AnnotationFragmentProps = Readonly<{
  annotation: ManuscriptAnnotation;
  children: ReactNode;
}>;

function AnnotationFragment({ annotation, children }: AnnotationFragmentProps) {
  switch (annotation.kind) {
    case "bold": {
      return (
        <strong className="kgv-annotation" data-annotation="bold">
          {children}
        </strong>
      );
    }
    case "italic": {
      return (
        <em className="kgv-annotation" data-annotation="italic">
          {children}
        </em>
      );
    }
    case "ruby": {
      return (
        <ruby className="kgv-annotation" data-annotation="ruby">
          {children}
          <rt aria-hidden="true">{annotation.reading}</rt>
        </ruby>
      );
    }
    case "emphasis": {
      return (
        <span
          className="kgv-annotation"
          data-annotation="emphasis"
          style={{ textEmphasis: cssString(annotation.mark) }}
        >
          {children}
        </span>
      );
    }
  }
}

function wrapAnnotations(annotations: readonly ManuscriptAnnotation[], children: ReactNode) {
  return annotations.reduceRight<ReactNode>(
    (wrapped, annotation) => (
      <AnnotationFragment key={annotationKey(annotation)} annotation={annotation}>
        {wrapped}
      </AnnotationFragment>
    ),
    children,
  );
}

function ManuscriptViewerComponent(
  {
    composed,
    diagnostics = NO_DIAGNOSTICS,
    activeDiagnosticId = null,
    zoom = ZoomMode.defaults,
    ariaLabel = "原稿プレビュー",
    className,
    onViewEvent,
    onDiagnosticSelect,
  }: ManuscriptViewerProps,
  ref: ForwardedRef<ManuscriptViewHandle>,
) {
  const { pages, geometry } = composed.layout;
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Array<HTMLElement | null>>([]);
  const diagnosticRefs = useRef(new Map<string, HTMLElement>());
  const pendingPageRef = useRef<number | null>(null);
  const visiblePageRef = useRef(0);
  const effectivePercentRef = useRef<number>(zoom.kind === "fixed" ? zoom.percent : 100);
  const [fitPercent, setFitPercent] = useState(100);
  const effectivePercent = zoom.kind === "fixed" ? zoom.percent : fitPercent;
  const selectedFont = FontPreset.of(composed.settings.appearance.fontPreset);

  const scrollToPage = useCallback(
    (index: number) => {
      const target = Math.min(Math.max(Math.trunc(index), 0), pages.length - 1);
      visiblePageRef.current = target;
      const page = pageRefs.current[target];
      if (page === null || page === undefined) {
        pendingPageRef.current = target;
      } else {
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
      getEffectiveZoomPercent: () => effectivePercentRef.current,
    }),
    [scrollToDiagnostic, scrollToPage],
  );

  const renderedPages = useMemo(
    () =>
      pages.map((page, pageIndex) => ({
        id: `page:${pageIndex}`,
        index: pageIndex,
        page,
        stages: page.stages.map((stage, stageIndex) => ({
          id: `page:${pageIndex}:stage:${stageIndex}`,
          lines: stage.lines.map((line, lineIndex) => ({
            id: `page:${pageIndex}:stage:${stageIndex}:line:${lineIndex}`,
            cells: line.cells.map((cell, cellIndex) => ({
              id: `page:${pageIndex}:stage:${stageIndex}:line:${lineIndex}:cell:${cellIndex}`,
              cell,
            })),
          })),
        })),
      })),
    [pages],
  );

  useEffect(() => {
    if (zoom.kind !== "fit") return;
    const viewport = viewportRef.current;
    if (viewport === null) return;
    const updateFitPercent = () => {
      const style = getComputedStyle(viewport);
      const width =
        viewport.clientWidth -
        Number.parseFloat(style.paddingInlineStart) -
        Number.parseFloat(style.paddingInlineEnd);
      const height =
        viewport.clientHeight -
        Number.parseFloat(style.paddingBlockStart) -
        Number.parseFloat(style.paddingBlockEnd);
      setFitPercent(
        ZoomMode.fitPagePercent(width, height, geometry.paperWidthMm, geometry.paperHeightMm),
      );
    };
    updateFitPercent();
    const observer = new ResizeObserver(updateFitPercent);
    observer.observe(viewport);
    return () => {
      observer.disconnect();
    };
  }, [geometry.paperHeightMm, geometry.paperWidthMm, zoom.kind]);

  useEffect(() => {
    effectivePercentRef.current = effectivePercent;
    onViewEvent?.({ kind: "effective-zoom.change", percent: effectivePercent });
  }, [effectivePercent, onViewEvent]);

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

  const style: ManuscriptStyle = useMemo(
    () => ({
      "--kgv-cell-size": `${geometry.cellSizeMm * (effectivePercent / 100)}mm`,
      "--kgv-line-gap": `${geometry.lineGapMm * (effectivePercent / 100)}mm`,
      "--kgv-manuscript-font": selectedFont.family,
      "--kgv-page-height": `${geometry.paperHeightMm * (effectivePercent / 100)}mm`,
      "--kgv-page-width": `${geometry.paperWidthMm * (effectivePercent / 100)}mm`,
    }),
    [effectivePercent, geometry, selectedFont.family],
  );

  const renderCell = (cellId: string, cell: GridCell) => {
    if (cell.value === null) return <span key={cellId} className="kgv-cell" />;
    const cellDiagnostics = diagnosticsForCell(cell, diagnostics);
    const first = cellDiagnostics.find((item) => startsInCell(cell, item));
    const active = cellDiagnostics.some(({ id }) => id === activeDiagnosticId);
    return (
      <span
        key={cellId}
        className="kgv-cell"
        data-diagnostic={cellDiagnostics.length > 0 ? "" : undefined}
        data-diagnostic-active={active ? "" : undefined}
        data-diagnostic-severity={first?.severity}
      >
        <span
          className={joinClassNames(
            "kgv-glyph",
            uprightGlyphPattern.test(cell.value) ? "kgv-glyph-upright" : undefined,
          )}
          aria-hidden="true"
        >
          {cell.value}
        </span>
        {first !== undefined && (
          <button
            ref={(element) => {
              for (const item of cellDiagnostics) {
                if (!startsInCell(cell, item)) continue;
                if (element === null) diagnosticRefs.current.delete(item.id);
                else diagnosticRefs.current.set(item.id, element);
              }
            }}
            type="button"
            className="kgv-diagnostic-marker"
            data-diagnostic-id={first.id}
            aria-label={`${first.location.start.line}行${first.location.start.column}列: ${first.message}`}
            onClick={() => onDiagnosticSelect?.(first)}
          />
        )}
      </span>
    );
  };

  return (
    <div className={joinClassNames("kgv-viewer", className)} aria-label={ariaLabel}>
      <div ref={viewportRef} className="kgv-viewport">
        <div className="kgv-stack" style={style}>
          {renderedPages.map(({ id, index: pageIndex, page, stages }) => (
            <section
              key={id}
              ref={(element) => {
                pageRefs.current[pageIndex] = element;
              }}
              data-page-index={pageIndex}
              className="kgv-page"
              aria-label={`${pageIndex + 1}ページ目、全${pages.length}ページ`}
              data-offscreen={pageIndex > 0 ? "" : undefined}
              data-overflow={geometry.fitsPaper ? undefined : ""}
            >
              <p className="kgv-visually-hidden">{pageText(page)}</p>
              <div className="kgv-page-grid">
                {stages.map(({ id: stageId, lines }) => (
                  <div key={stageId} className="kgv-stage">
                    {lines.map(({ id: lineId, cells }) => (
                      <div key={lineId} className="kgv-line">
                        {fragmentCells(cells).map((fragment) => {
                          const rendered = fragment.cells.map(({ id: cellId, cell }) =>
                            renderCell(cellId, cell),
                          );
                          return fragment.annotations.length === 0 ? (
                            rendered
                          ) : (
                            <span key={fragment.id} className="kgv-annotation-stack">
                              {wrapAnnotations(fragment.annotations, rendered)}
                            </span>
                          );
                        })}
                      </div>
                    ))}
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

export const ManuscriptViewer = forwardRef(ManuscriptViewerComponent);
