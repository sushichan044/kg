const CSS_PIXELS_PER_MM = 96 / 25.4;

type FitZoomOptions = Readonly<{
  viewportWidthPx: number;
  viewportHeightPx: number;
  paperWidthMm: number;
  paperHeightMm: number;
  min: number;
  max: number;
  step: number;
}>;

/**
 * Returns the largest configured zoom level at which the complete page fits its viewport.
 */
export function fitZoom({
  viewportWidthPx,
  viewportHeightPx,
  paperWidthMm,
  paperHeightMm,
  min,
  max,
  step,
}: FitZoomOptions): number {
  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    !Number.isFinite(step) ||
    min < 1 ||
    max < min ||
    step <= 0
  ) {
    throw new RangeError("Invalid zoom configuration");
  }
  if (viewportWidthPx <= 0 || viewportHeightPx <= 0) return min;

  const fitPercent = Math.min(
    (viewportWidthPx / (paperWidthMm * CSS_PIXELS_PER_MM)) * 100,
    (viewportHeightPx / (paperHeightMm * CSS_PIXELS_PER_MM)) * 100,
  );
  const bounded = Math.min(max, Math.max(min, fitPercent));
  const steps = Math.floor((bounded - min) / step + 1e-9);

  return Math.max(min, Math.min(max, min + steps * step));
}
