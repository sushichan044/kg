import type * as v from "valibot";

import { nonNegativeInteger, positiveInteger, readonlyObject } from "../internal/schema";

const SourcePositionSchema = readonlyObject({
  offset: nonNegativeInteger(),
  line: positiveInteger(),
  column: positiveInteger(),
});

/**
 * ソーステキスト上の 1 点。UTF-16 オフセットと、それが位置する 1 始まりの行・列で表す。
 */
export type SourcePosition = v.InferOutput<typeof SourcePositionSchema>;

export const SourcePosition = {
  schema: SourcePositionSchema,

  /**
   * CRLF、CR、LF をそれぞれ 1 つの改行として数える。列は行頭からの UTF-16 コード単位数。
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
