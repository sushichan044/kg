import * as v from "valibot";

const readonlyObject = <const TEntries extends v.ObjectEntries>(entries: TEntries) =>
  v.pipe(v.strictObject(entries), v.readonly());

export const TextRangeSchema = v.pipe(
  readonlyObject({
    start: v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0)),
    end: v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0)),
  }),
  v.check(({ start, end }) => end >= start, "range end must not precede its start"),
);
export type TextRange = v.InferOutput<typeof TextRangeSchema>;

export const SourceRangeSchema = v.pipe(TextRangeSchema, v.brand("SourceRange"));

export type SourceRange = v.InferOutput<typeof SourceRangeSchema>;

export const DisplayRangeSchema = v.pipe(TextRangeSchema, v.brand("DisplayRange"));

export type DisplayRange = v.InferOutput<typeof DisplayRangeSchema>;

export const GraphemeRangeSchema = v.pipe(TextRangeSchema, v.brand("GraphemeRange"));
export type GraphemeRange = v.InferOutput<typeof GraphemeRangeSchema>;

export const ManuscriptRangeSchema = readonlyObject({
  source: SourceRangeSchema,
  display: DisplayRangeSchema,
  graphemes: GraphemeRangeSchema,
});
export type ManuscriptRange = v.InferOutput<typeof ManuscriptRangeSchema>;

export const SourcePositionSchema = readonlyObject({
  offset: v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0)),
  line: v.pipe(v.number(), v.finite(), v.integer(), v.minValue(1)),
  column: v.pipe(v.number(), v.finite(), v.integer(), v.minValue(1)),
});
export type SourcePosition = v.InferOutput<typeof SourcePositionSchema>;

export const DiagnosticOriginSchema = v.variant("kind", [
  readonlyObject({ kind: v.literal("parser"), id: v.string() }),
  readonlyObject({ kind: v.literal("rule"), id: v.string() }),
]);

type DiagnosticOrigin = v.InferOutput<typeof DiagnosticOriginSchema>;

export const ManuscriptDiagnosticSchema = readonlyObject({
  id: v.string(),
  origin: DiagnosticOriginSchema,
  severity: v.picklist(["warning", "error"]),
  message: v.string(),
  range: ManuscriptRangeSchema,
  location: readonlyObject({ start: SourcePositionSchema, end: SourcePositionSchema }),
});

export type ManuscriptDiagnostic = v.InferOutput<typeof ManuscriptDiagnosticSchema>;

export const ManuscriptProcessingErrorSchema = readonlyObject({
  stage: v.picklist(["parse", "compose", "proofread"]),
  code: v.string(),
  message: v.string(),
});

export type ManuscriptProcessingError = v.InferOutput<typeof ManuscriptProcessingErrorSchema>;

export type ManuscriptResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly warnings: readonly ManuscriptDiagnostic[];
    }
  | {
      readonly ok: false;
      readonly errors: readonly ManuscriptProcessingError[];
    };

export function success<T>(
  value: T,
  warnings: readonly ManuscriptDiagnostic[] = [],
): ManuscriptResult<T> {
  return { ok: true, value, warnings };
}

export function failure<T>(
  stage: ManuscriptProcessingError["stage"],
  code: string,
  message: string,
): ManuscriptResult<T> {
  return { ok: false, errors: [{ stage, code, message }] };
}

export function mergeManuscriptRanges(
  ranges: ReadonlyArray<ManuscriptRange | null>,
): ManuscriptRange | null {
  const present = ranges.filter((range): range is ManuscriptRange => range !== null);
  if (present.length === 0) return null;

  return v.parse(ManuscriptRangeSchema, {
    source: {
      start: Math.min(...present.map(({ source }) => source.start)),
      end: Math.max(...present.map(({ source }) => source.end)),
    },
    display: {
      start: Math.min(...present.map(({ display }) => display.start)),
      end: Math.max(...present.map(({ display }) => display.end)),
    },
    graphemes: {
      start: Math.min(...present.map(({ graphemes }) => graphemes.start)),
      end: Math.max(...present.map(({ graphemes }) => graphemes.end)),
    },
  });
}

export function sourcePosition(source: string, offset: number): SourcePosition {
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
}

export function diagnostic(
  source: string,
  origin: DiagnosticOrigin,
  severity: ManuscriptDiagnostic["severity"],
  code: string,
  message: string,
  range: ManuscriptRange,
): ManuscriptDiagnostic {
  return {
    id: `${origin.kind}:${origin.id}:${code}:${range.source.start}:${range.source.end}`,
    origin,
    severity,
    message,
    range,
    location: {
      start: sourcePosition(source, range.source.start),
      end: sourcePosition(source, range.source.end),
    },
  };
}
