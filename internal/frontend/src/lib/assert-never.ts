/**
 * コンパイラーが到達不能と証明した分岐を示す。実行時にここへ到達したなら、
 * ユニオンにバリアントを加えたのに、この呼び出しを生んだ switch を更新していない。
 */
export function assertNever(value: never): never {
  throw new TypeError(`unhandled variant: ${JSON.stringify(value)}`);
}
