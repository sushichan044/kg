import { FontPreset } from "@sushichan044/kg-core";
import type {
  DiagnosticSeverity,
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

import { fitZoom } from "./fit-zoom";

const NO_DIAGNOSTICS: readonly ManuscriptDiagnostic[] = [];

const DEFAULT_ZOOM = {
  value: 100,
  min: 1,
  max: Number.MAX_SAFE_INTEGER,
  step: 1,
} satisfies Omit<ManuscriptViewerZoom, "onChange">;

export type ManuscriptViewerProps = Readonly<{
  composed: GridComposedManuscript;
  diagnostics?: readonly ManuscriptDiagnostic[];
  activeDiagnosticId?: string | null;
  zoom?: ManuscriptViewerZoom;
  fit?: boolean;
  ariaLabel?: string;
  className?: string;
  onViewEvent?: (event: ManuscriptViewEvent) => void;
  onDiagnosticSelect?: (diagnostic: ManuscriptDiagnostic) => void;
}>;

export type ManuscriptViewerZoom = Readonly<{
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}>;

export type ManuscriptViewEvent = Readonly<{ kind: "visible-page.change"; page: number }>;

export type ManuscriptViewHandle = Readonly<{
  scrollToPage: (index: number) => void;
  scrollToDiagnostic: (id: string) => void;
  getVisiblePage: () => number;
}>;

type ManuscriptStyle = CSSProperties & {
  "--kgv-cell-size": string;
  "--kgv-line-gap": string;
  "--kgv-manuscript-font": string;
  "--kgv-page-height": string;
  "--kgv-page-width": string;
};

/**
 * A band is placed in cells rather than in a length, so the stylesheet resolves it against the cell
 * size that is already scaled by the zoom.
 */
type BandStyle = CSSProperties & {
  "--kgv-band-lane": number;
  "--kgv-band-lanes": number;
  "--kgv-band-length": number;
  "--kgv-band-offset": number;
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

function covers(cell: GridCell, diagnostic: ManuscriptDiagnostic): boolean {
  if (cell.range === null) return false;
  const sourceRange = cell.range.source;
  return (
    diagnostic.range.source.start < sourceRange.end &&
    diagnostic.range.source.end > sourceRange.start
  );
}

function diagnosticsForCell(
  cell: GridCell,
  diagnostics: readonly ManuscriptDiagnostic[],
): ManuscriptDiagnostic[] {
  return diagnostics.filter((diagnostic) => covers(cell, diagnostic));
}

/**
 * The strongest severity covering a cell. A cell inside two diagnostics carries the worse of the
 * two rather than whichever the caller happened to list first.
 */
function cellSeverity(
  diagnostics: readonly ManuscriptDiagnostic[],
): DiagnosticSeverity | undefined {
  if (diagnostics.length === 0) return undefined;

  return diagnostics.some(({ severity }) => severity === "error") ? "error" : "warning";
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

type DiagnosticBand = Readonly<{
  diagnostic: ManuscriptDiagnostic;
  /**
   * Where the run starts and how long it is, counted in cells from the head of the line.
   */
  offset: number;
  length: number;
  /**
   * Which share of the line's width the band takes, and how many shares there are. Bands over
   * different runs each take the whole width; bands over exactly the same run split it, since
   * identical boxes would leave every one but the frontmost impossible to click.
   */
  lane: number;
  lanes: number;
  /**
   * Whether the diagnostic starts in this line, which is the band that carries its control.
   */
  startsHere: boolean;
}>;

type PlacedBand = Omit<DiagnosticBand, "lane" | "lanes">;

function spanKey({ offset, length }: PlacedBand): string {
  return `${offset}:${length}`;
}

/**
 * One band per diagnostic reaching the line, covering every cell it touches. Longer bands come
 * first so a band nested inside another paints — and answers to a click — on top of it. Bands over
 * the same run cannot be told apart that way, so they are given a lane each instead.
 */
function diagnosticBands(
  cells: readonly RenderedCell[],
  diagnostics: readonly ManuscriptDiagnostic[],
): DiagnosticBand[] {
  const placed: PlacedBand[] = [];
  for (const diagnostic of diagnostics) {
    let offset = -1;
    let end = -1;
    let startsHere = false;
    for (const [index, { cell }] of cells.entries()) {
      if (!covers(cell, diagnostic)) continue;

      if (offset < 0) offset = index;
      end = index;
      startsHere ||= startsInCell(cell, diagnostic);
    }
    if (offset < 0) continue;

    placed.push({ diagnostic, offset, length: end - offset + 1, startsHere });
  }
  placed.sort((left, right) => left.offset - right.offset || right.length - left.length);

  const lanes = new Map<string, number>();
  for (const band of placed) lanes.set(spanKey(band), (lanes.get(spanKey(band)) ?? 0) + 1);

  const taken = new Map<string, number>();
  const bands: DiagnosticBand[] = [];
  for (const band of placed) {
    const key = spanKey(band);
    const lane = taken.get(key) ?? 0;
    taken.set(key, lane + 1);

    bands.push({
      diagnostic: band.diagnostic,
      offset: band.offset,
      length: band.length,
      lane,
      lanes: lanes.get(key) ?? 1,
      startsHere: band.startsHere,
    });
  }

  return bands;
}

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

const graphemes = new Intl.Segmenter("ja", { granularity: "grapheme" });

type ReadingCharacter = Readonly<{ character: string; offset: number }>;

/**
 * A reading, split so each character can be placed on its own. Letter-spacing would be shorter, but
 * engines disagree on where the space around a character goes in a vertical flow; one box per
 * character leaves nothing to disagree about. The offset identifies a character even when the
 * reading repeats one.
 */
function readingCharacters(reading: string): ReadingCharacter[] {
  return [...graphemes.segment(reading)].map(({ segment, index }) => ({
    character: segment,
    offset: index,
  }));
}

type AnnotationFragmentProps = Readonly<{
  annotation: ManuscriptAnnotation;
  /**
   * Offset and length of the cells this fragment covers within the complete annotation base.
   */
  baseOffset: number;
  baseCharacters: number;
  children: ReactNode;
}>;

function AnnotationFragment({
  annotation,
  baseOffset,
  baseCharacters,
  children,
}: AnnotationFragmentProps) {
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
      const reading = readingCharacters(annotation.reading);
      const annotationBaseCharacters =
        annotation.range.graphemes.end - annotation.range.graphemes.start;
      // One reading character per base character belongs to the character below it — mono ruby.
      // Any other count belongs to the compound as a whole — group ruby. structural.css places the
      // two differently.
      const fit = reading.length === annotationBaseCharacters ? "mono" : "group";
      const fragmentReading =
        fit === "mono" ? reading.slice(baseOffset, baseOffset + baseCharacters) : reading;
      return (
        <ruby className="kgv-annotation" data-annotation="ruby" data-ruby-fit={fit}>
          {children}
          {/* The reading is placed by the box inside the <rt> rather than by the <rt> itself:
              engines lay ruby text out themselves and disagree about how much of that a stylesheet
              may take over, but they all treat a plain span as a plain span. */}
          <rt aria-hidden="true">
            <span className="kgv-ruby">
              {fragmentReading.map(({ character, offset }) => (
                <span key={offset} className="kgv-ruby-character">
                  {character}
                </span>
              ))}
            </span>
          </rt>
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

function wrapAnnotations(
  annotations: readonly ManuscriptAnnotation[],
  baseStart: number,
  baseCharacters: number,
  children: ReactNode,
) {
  return annotations.reduceRight<ReactNode>(
    (wrapped, annotation) => (
      <AnnotationFragment
        key={annotationKey(annotation)}
        annotation={annotation}
        baseOffset={baseStart - annotation.range.graphemes.start}
        baseCharacters={baseCharacters}
      >
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
    zoom,
    fit = false,
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
    if (!fit) return;
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

  const style: ManuscriptStyle = useMemo(
    () => ({
      "--kgv-cell-size": `${geometry.cellSizeMm * (value / 100)}mm`,
      "--kgv-line-gap": `${geometry.lineGapMm * (value / 100)}mm`,
      "--kgv-manuscript-font": selectedFont.family,
      "--kgv-page-height": `${geometry.paperHeightMm * (value / 100)}mm`,
      "--kgv-page-width": `${geometry.paperWidthMm * (value / 100)}mm`,
    }),
    [geometry, selectedFont.family, value],
  );

  /**
   * A cell carries how its own character is marked. The decoration covering a range of characters
   * belongs to the diagnostic band instead, so neither can restyle the other by accident.
   */
  const renderCell = (cellId: string, cell: GridCell) => {
    if (cell.value === null) return <span key={cellId} className="kgv-cell" />;
    const cellDiagnostics = diagnosticsForCell(cell, diagnostics);
    const active = cellDiagnostics.some(({ id }) => id === activeDiagnosticId);
    return (
      <span
        key={cellId}
        className="kgv-cell"
        data-diagnostic={cellDiagnostics.length > 0 ? "" : undefined}
        data-diagnostic-active={active ? "" : undefined}
        data-diagnostic-severity={cellSeverity(cellDiagnostics)}
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
      </span>
    );
  };

  const renderBand = ({ diagnostic, offset, length, lane, lanes, startsHere }: DiagnosticBand) => {
    const style: BandStyle = {
      "--kgv-band-lane": lane,
      "--kgv-band-lanes": lanes,
      "--kgv-band-length": length,
      "--kgv-band-offset": offset,
    };
    const active = diagnostic.id === activeDiagnosticId;

    // A diagnostic split across lines keeps one control, on the band it starts in, so assistive
    // technology is offered the finding once however the grid happened to break it.
    if (!startsHere) {
      return (
        <span
          key={diagnostic.id}
          className="kgv-diagnostic-band"
          data-diagnostic-id={diagnostic.id}
          data-diagnostic-severity={diagnostic.severity}
          data-diagnostic-active={active ? "" : undefined}
          data-diagnostic-continued=""
          style={style}
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
        style={style}
        aria-label={`${diagnostic.location.start.line}行${diagnostic.location.start.column}列: ${diagnostic.message}`}
        onClick={() => onDiagnosticSelect?.(diagnostic)}
      />
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
                    {lines.map(({ id: lineId, cells }) => {
                      const bands = diagnosticBands(cells, diagnostics);
                      return (
                        <div key={lineId} className="kgv-line">
                          <span className="kgv-line-rules" aria-hidden="true">
                            {cells.map(({ id: cellId }) => (
                              <span key={cellId} className="kgv-rule-cell" />
                            ))}
                          </span>
                          {fragmentCells(cells).map((fragment) => {
                            const rendered = fragment.cells.map(({ id: cellId, cell }) =>
                              renderCell(cellId, cell),
                            );
                            return fragment.annotations.length === 0 ? (
                              rendered
                            ) : (
                              <span key={fragment.id} className="kgv-annotation-stack">
                                {wrapAnnotations(
                                  fragment.annotations,
                                  fragment.cells[0]?.cell.range?.graphemes.start ?? 0,
                                  fragment.cells.length,
                                  rendered,
                                )}
                              </span>
                            );
                          })}
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

export const ManuscriptViewer = forwardRef(ManuscriptViewerComponent);
