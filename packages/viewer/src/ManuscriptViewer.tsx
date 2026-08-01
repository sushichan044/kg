import { fitPagePercent, fontPreset } from "@sushichan044/kg-core";
import type { ManuscriptDiagnostic, OccupiedCell, Page, Stage } from "@sushichan044/kg-core";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ForwardedRef } from "react";

import { useEffectiveZoom, useManuscriptDispatch, useManuscriptState } from "./Provider";

export interface ManuscriptViewerProps {
  ariaLabel?: string;
  className?: string;
  onViewEvent?: (event: ManuscriptViewEvent) => void;
  onDiagnosticSelect?: (diagnostic: ManuscriptDiagnostic) => void;
}

export type ManuscriptViewEvent =
  | { type: "visible-page.change"; page: number }
  | { type: "effective-zoom.change"; percent: number };

export interface ManuscriptViewHandle {
  scrollToPage: (index: number) => void;
  scrollToDiagnostic: (id: string) => void;
  getVisiblePage: () => number;
  getEffectiveZoomPercent: () => number;
}

type ManuscriptStyle = CSSProperties & {
  "--kgv-cell-size": string;
  "--kgv-manuscript-font": string;
  "--kgv-page-height": string;
  "--kgv-page-width": string;
};

const uprightGlyphPattern = /^(?:\p{Script=Latin}|[0-9])/u;
function pageText(page: Page): string {
  return page
    .flatMap((stage: Stage) =>
      stage.map((line) => line.flatMap((cell) => (cell === null ? [] : [cell.grapheme])).join("")),
    )
    .join("\n");
}

function diagnosticsForCell(
  cell: OccupiedCell,
  diagnostics: readonly ManuscriptDiagnostic[],
): ManuscriptDiagnostic[] {
  return diagnostics.filter(
    ({ range }) => range.start < cell.sourceRange.end && range.end > cell.sourceRange.start,
  );
}

function startsInCell(cell: OccupiedCell, diagnostic: ManuscriptDiagnostic): boolean {
  return (
    diagnostic.range.start >= cell.sourceRange.start &&
    diagnostic.range.start < cell.sourceRange.end
  );
}

function joinClassNames(...names: Array<string | undefined>): string {
  return names.filter((name) => name !== undefined && name !== "").join(" ");
}

function ManuscriptViewerComponent(
  {
    ariaLabel = "原稿プレビュー",
    className,
    onViewEvent,
    onDiagnosticSelect,
  }: ManuscriptViewerProps,
  ref: ForwardedRef<ManuscriptViewHandle>,
) {
  const { appearance, activeDiagnosticId, diagnostics, geometry, pagination, zoom } =
    useManuscriptState((state) => state);
  const dispatch = useManuscriptDispatch();
  const [, setSharedEffectiveZoom] = useEffectiveZoom();
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Array<HTMLElement | null>>([]);
  const diagnosticRefs = useRef(new Map<string, HTMLElement>());
  const pendingPageRef = useRef<number | null>(null);
  const visiblePageRef = useRef(0);
  const effectivePercentRef = useRef<number>(zoom.mode === "fixed" ? zoom.percent : 100);
  const [fitPercent, setFitPercent] = useState(100);
  const effectivePercent = zoom.mode === "fixed" ? zoom.percent : fitPercent;
  const selectedFont = fontPreset(appearance.fontPreset);
  const scrollToPage = useCallback(
    (index: number) => {
      const target = Math.min(Math.max(Math.trunc(index), 0), pagination.pages.length - 1);
      visiblePageRef.current = target;
      const page = pageRefs.current[target];
      if (page === null || page === undefined) {
        pendingPageRef.current = target;
      } else {
        pendingPageRef.current = null;
        page.scrollIntoView({ block: "start" });
      }
    },
    [pagination.pages.length],
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
      pagination.pages.map((page, pageIndex) => ({
        id: `page:${pageIndex}`,
        index: pageIndex,
        page,
        stages: page.map((stage, stageIndex) => ({
          id: `page:${pageIndex}:stage:${stageIndex}`,
          lines: stage.map((line, lineIndex) => ({
            id: `page:${pageIndex}:stage:${stageIndex}:line:${lineIndex}`,
            cells: line.map((cell, cellIndex) => ({
              id: `page:${pageIndex}:stage:${stageIndex}:line:${lineIndex}:cell:${cellIndex}`,
              cell,
            })),
          })),
        })),
      })),
    [pagination.pages],
  );

  useEffect(() => {
    if (zoom.mode !== "fit") {
      return;
    }
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }

    const updateFitPercent = () => {
      const style = getComputedStyle(viewport);
      const availableWidth =
        viewport.clientWidth -
        Number.parseFloat(style.paddingInlineStart) -
        Number.parseFloat(style.paddingInlineEnd);
      const availableHeight =
        viewport.clientHeight -
        Number.parseFloat(style.paddingBlockStart) -
        Number.parseFloat(style.paddingBlockEnd);
      setFitPercent(
        fitPagePercent(
          availableWidth,
          availableHeight,
          geometry.paperWidthMm,
          geometry.paperHeightMm,
        ),
      );
    };

    updateFitPercent();
    const observer = new ResizeObserver(updateFitPercent);
    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, [geometry.paperHeightMm, geometry.paperWidthMm, zoom.mode]);

  useEffect(() => {
    effectivePercentRef.current = effectivePercent;
    setSharedEffectiveZoom(effectivePercent);
    onViewEvent?.({ type: "effective-zoom.change", percent: effectivePercent });
  }, [effectivePercent, onViewEvent, setSharedEffectiveZoom]);

  useEffect(() => {
    if (pendingPageRef.current !== null) {
      scrollToPage(pendingPageRef.current);
    }
  }, [pagination.pages, scrollToPage]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visible !== undefined) {
          const page = Number(visible.target.getAttribute("data-page-index"));
          visiblePageRef.current = page;
          onViewEvent?.({ type: "visible-page.change", page });
        }
      },
      { root: viewport, threshold: [0.25, 0.5, 0.75] },
    );
    for (const page of pageRefs.current) {
      if (page !== null) {
        observer.observe(page);
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [onViewEvent, pagination.pages]);

  useEffect(() => {
    if (activeDiagnosticId !== null) {
      scrollToDiagnostic(activeDiagnosticId);
    }
  }, [activeDiagnosticId, pagination.pages, scrollToDiagnostic]);

  const style: ManuscriptStyle = useMemo(() => {
    return {
      "--kgv-cell-size": `${geometry.cellSizeMm * (effectivePercent / 100)}mm`,
      "--kgv-manuscript-font": selectedFont.family,
      "--kgv-page-height": `${geometry.paperHeightMm * (effectivePercent / 100)}mm`,
      "--kgv-page-width": `${geometry.paperWidthMm * (effectivePercent / 100)}mm`,
    };
  }, [
    geometry.cellSizeMm,
    geometry.paperHeightMm,
    geometry.paperWidthMm,
    effectivePercent,
    selectedFont.family,
  ]);

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
              aria-label={`${pageIndex + 1}ページ目、全${pagination.pages.length}ページ`}
              data-offscreen={pageIndex > 0 ? "" : undefined}
              data-overflow={geometry.fitsPaper ? undefined : ""}
            >
              <p className="kgv-visually-hidden">{pageText(page)}</p>
              <div className="kgv-page-grid">
                {stages.map(({ id: stageId, lines }) => (
                  <div key={stageId} className="kgv-stage">
                    {lines.map(({ id: lineId, cells }) => (
                      <div key={lineId} className="kgv-line">
                        {cells.map(({ id: cellId, cell }) => {
                          if (cell === null) {
                            return <span key={cellId} className="kgv-cell" />;
                          }
                          const cellDiagnostics = diagnosticsForCell(cell, diagnostics);
                          const first = cellDiagnostics.find((diagnostic) =>
                            startsInCell(cell, diagnostic),
                          );
                          const active = cellDiagnostics.some(
                            (diagnostic) => diagnostic.id === activeDiagnosticId,
                          );

                          return (
                            <span
                              key={cellId}
                              className="kgv-cell"
                              data-diagnostic={cellDiagnostics.length > 0 ? "" : undefined}
                              data-diagnostic-active={active ? "" : undefined}
                            >
                              <span
                                className={joinClassNames(
                                  "kgv-glyph",
                                  uprightGlyphPattern.test(cell.grapheme)
                                    ? "kgv-glyph-upright"
                                    : undefined,
                                )}
                                aria-hidden="true"
                              >
                                {cell.grapheme}
                              </span>
                              {first !== undefined && (
                                <button
                                  ref={(element) => {
                                    for (const diagnostic of cellDiagnostics) {
                                      if (!startsInCell(cell, diagnostic)) {
                                        continue;
                                      }
                                      if (element === null) {
                                        diagnosticRefs.current.delete(diagnostic.id);
                                      } else {
                                        diagnosticRefs.current.set(diagnostic.id, element);
                                      }
                                    }
                                  }}
                                  type="button"
                                  className="kgv-diagnostic-marker"
                                  aria-label={`${first.location.start.line}行${first.location.start.column}列: ${first.message}`}
                                  onClick={() => {
                                    dispatch({ type: "diagnostic.select", id: first.id });
                                    onDiagnosticSelect?.(first);
                                  }}
                                />
                              )}
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
