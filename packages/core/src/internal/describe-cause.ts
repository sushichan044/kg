/**
 * 投げられた値を表示用の文字列にする。値が Error であるとは仮定しない。
 */
export function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
