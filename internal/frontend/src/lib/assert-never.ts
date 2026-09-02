/**
 * Marks a branch the compiler proved unreachable. Reaching it at runtime means a variant was added
 * to a union without updating the switch that produced this call.
 */
export function assertNever(value: never): never {
  throw new TypeError(`unhandled variant: ${JSON.stringify(value)}`);
}
