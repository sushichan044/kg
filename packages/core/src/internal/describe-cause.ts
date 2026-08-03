/**
 * Renders an unknown throwable for display, without assuming it is an Error.
 */
export function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
