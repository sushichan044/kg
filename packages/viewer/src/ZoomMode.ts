export const ZOOM_LEVELS = [50, 75, 100, 125, 150] as const;

export type FixedZoomPercent = (typeof ZOOM_LEVELS)[number];

/**
 * Either a fixed magnification, or "fit", which the viewer resolves against its viewport.
 */
export type ZoomMode =
  | Readonly<{ kind: "fixed"; percent: FixedZoomPercent }>
  | Readonly<{ kind: "fit" }>;

const MAX_FIT_PERCENT = Math.max(...ZOOM_LEVELS);
const CSS_PIXELS_PER_MM = 96 / 25.4;

export const ZoomMode = {
  defaults: { kind: "fixed", percent: 100 } as const satisfies ZoomMode,

  /**
   * The next level in `direction`, or null when already at the end of the scale.
   */
  adjacentLevel: (effectivePercent: number, direction: "in" | "out"): FixedZoomPercent | null => {
    const levels = direction === "in" ? ZOOM_LEVELS : [...ZOOM_LEVELS].reverse();
    return (
      levels.find((level) =>
        direction === "in" ? level > effectivePercent : level < effectivePercent,
      ) ?? null
    );
  },

  /**
   * The magnification at which a whole page fits the viewport, never magnifying past the scale.
   */
  fitPagePercent: (
    viewportWidthPx: number,
    viewportHeightPx: number,
    paperWidthMm: number,
    paperHeightMm: number,
  ): number => {
    if (viewportWidthPx <= 0 || viewportHeightPx <= 0) return 100;
    return Math.min(
      (viewportWidthPx / (paperWidthMm * CSS_PIXELS_PER_MM)) * 100,
      (viewportHeightPx / (paperHeightMm * CSS_PIXELS_PER_MM)) * 100,
      MAX_FIT_PERCENT,
    );
  },
} as const;
