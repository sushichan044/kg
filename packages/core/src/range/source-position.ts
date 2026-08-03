import type * as v from "valibot";

import { nonNegativeInteger, positiveInteger, readonlyObject } from "../internal/schema";

const SourcePositionSchema = readonlyObject({
  offset: nonNegativeInteger(),
  line: positiveInteger(),
  column: positiveInteger(),
});

/**
 * A point in the source text as a UTF-16 offset plus the 1-based line and column it lands on.
 */
export type SourcePosition = v.InferOutput<typeof SourcePositionSchema>;

export const SourcePosition = {
  schema: SourcePositionSchema,

  /**
   * Counts CRLF, CR and LF as one line break each; column is UTF-16 code units from line start.
   */
  at: (source: string, offset: number): SourcePosition => {
    let line = 1;
    let lineStart = 0;
    let index = 0;
    while (index < offset) {
      if (source[index] === "\r") {
        index += source[index + 1] === "\n" ? 2 : 1;
        line += 1;
        lineStart = index;
      } else if (source[index] === "\n") {
        index += 1;
        line += 1;
        lineStart = index;
      } else {
        index += 1;
      }
    }

    return { offset, line, column: offset - lineStart + 1 };
  },
} as const;
