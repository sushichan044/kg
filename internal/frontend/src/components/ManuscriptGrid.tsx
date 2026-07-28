import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

import type { ManuscriptGeometry } from "../lib/manuscriptAppearance";
import type { Page, Stage } from "../lib/pagination";

interface ManuscriptGridProps {
  pages: Page[];
  geometry: ManuscriptGeometry;
  fontFamily: string;
  scale: number;
  // restoreToPage is the page index to scroll to when the pagination changes
  // (file switch, or a setting that changed the page count).
  restoreToPage: number;
  onVisiblePageChange: (index: number) => void;
}

type ManuscriptStyle = CSSProperties & {
  "--cell-size": string;
  "--manuscript-font": string;
  "--page-height": string;
  "--page-width": string;
};

// Latin text and ASCII digits follow the preview's upright-per-cell contract;
// every other grapheme delegates its orientation to Unicode via CSS mixed mode.
const uprightGlyphPattern = /^(?:\p{Script=Latin}|[0-9])/u;

// pageText reconstructs a page's source text in logical reading order for the
// screen-reader-only element, so assistive tech reads prose instead of a wall of
// empty grid cells.
function pageText(page: Page): string {
  return page
    .flatMap((stage: Stage) => stage.map((line) => line.filter((cell) => cell !== null).join("")))
    .join("\n");
}

export function ManuscriptGrid({
  pages,
  geometry,
  fontFamily,
  scale,
  restoreToPage,
  onVisiblePageChange,
}: ManuscriptGridProps) {
  const pageRefs = useRef<Array<HTMLElement | null>>([]);
  const restoreRef = useRef(restoreToPage);
  restoreRef.current = restoreToPage;
  const style: ManuscriptStyle = {
    "--cell-size": `${geometry.cellSizeMm * scale}mm`,
    "--manuscript-font": fontFamily,
    "--page-height": `${geometry.paperHeightMm * scale}mm`,
    "--page-width": `${geometry.paperWidthMm * scale}mm`,
  };

  // Scroll to the remembered page whenever the pagination changes.
  useEffect(() => {
    const target = Math.min(Math.max(restoreRef.current, 0), pages.length - 1);
    pageRefs.current[target]?.scrollIntoView({ block: "start" });
  }, [pages]);

  // Report the most-visible page so the caller can remember it.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const index = Number(visible.target.getAttribute("data-page-index"));
          onVisiblePageChange(index);
        }
      },
      { threshold: [0.25, 0.5, 0.75] },
    );

    for (const el of pageRefs.current) {
      if (el) {
        observer.observe(el);
      }
    }

    return () => observer.disconnect();
  }, [pages, onVisiblePageChange]);

  return (
    <div className="manuscript-stack" style={style}>
      {pages.map((page, pageIndex) => (
        <section
          // Page order is stable for a given pagination, so the index is a valid key.
          // eslint-disable-next-line react-x/no-array-index-key
          key={pageIndex}
          ref={(el) => {
            pageRefs.current[pageIndex] = el;
          }}
          data-page-index={pageIndex}
          data-paper-width-mm={geometry.paperWidthMm}
          data-paper-height-mm={geometry.paperHeightMm}
          className="manuscript-page"
          aria-label={`${pageIndex + 1}ページ目、全${pages.length}ページ`}
          // The first page is above the fold; defer only later pages.
          data-offscreen={pageIndex > 0 ? "" : undefined}
        >
          <p className="visually-hidden">{pageText(page)}</p>
          <div className="manuscript-page__grid" aria-hidden="true">
            {page.map((stage, stageIndex) => (
              // eslint-disable-next-line react-x/no-array-index-key
              <div key={stageIndex} className="manuscript-stage">
                {stage.map((line, lineIndex) => (
                  // eslint-disable-next-line react-x/no-array-index-key
                  <div key={lineIndex} className="manuscript-line">
                    {line.map((cell, cellIndex) => (
                      // eslint-disable-next-line react-x/no-array-index-key
                      <span key={cellIndex} className="manuscript-cell">
                        {cell === null ? null : (
                          <span
                            className={
                              uprightGlyphPattern.test(cell)
                                ? "manuscript-glyph manuscript-glyph--upright"
                                : "manuscript-glyph"
                            }
                          >
                            {cell}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
