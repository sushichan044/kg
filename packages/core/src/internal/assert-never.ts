/**
 * コンパイラーが到達不能と証明した分岐を示す。実行時にここへ到達したなら、
 * 共用体にバリアントを追加したのに、この呼び出しを生む switch を更新していないということである。
 */
export function assertNever(value: never): never {
  throw new TypeError(`unhandled variant: ${JSON.stringify(value)}`);
}
