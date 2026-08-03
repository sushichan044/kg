/**
 * The scale {@link ZoomMode.adjacentLevel} steps through by default. Nothing constrains a consumer
 * to it, or to any scale at all: `percent` is whatever magnification you ask for, so a slider or a
 * pinch gesture works as well as buttons.
 */
export const ZOOM_LEVELS = [50, 75, 100, 125, 150] as const;

const CSS_PIXELS_PER_MM = 96 / 25.4;

/**
 * Either a fixed magnification, or "fit", which the viewer resolves against its viewport.
 */
export type ZoomMode = Readonly<{ kind: "fixed"; percent: number }> | Readonly<{ kind: "fit" }>;

export const ZoomMode = {
  defaults: { kind: "fixed", percent: 100 } as const satisfies ZoomMode,

  /**
   * The next level in `direction`, or null when already at the end of the scale. Pass `levels` to
   * step through a scale of your own; the order they come in does not matter.
   */
  adjacentLevel: (
    effectivePercent: number,
    direction: "in" | "out",
    levels: readonly number[] = ZOOM_LEVELS,
  ): number | null => {
    const ordered = [...levels].sort((left, right) =>
      direction === "in" ? left - right : right - left,
    );
    return (
      ordered.find((level) =>
        direction === "in" ? level > effectivePercent : level < effectivePercent,
      ) ?? null
    );
  },

  /**
   * The magnification at which a whole page fits the viewport, whatever that turns out to be. It is
   * deliberately not capped: how large a page may grow is the consuming application's call, so
   * clamp the result if a ceiling suits your layout.
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
    );
  },
} as const;
