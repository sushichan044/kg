import * as v from "valibot";

import { diagnostic, failure, success } from "./model";
import {
  ManuscriptDiagnosticSchema,
  ManuscriptProcessingErrorSchema,
  ManuscriptRangeSchema,
} from "./model";
import type { ManuscriptRange, ManuscriptResult } from "./model";

const readonlyObject = <const TEntries extends v.ObjectEntries>(entries: TEntries) =>
  v.pipe(v.strictObject(entries), v.readonly());

export const ParsedGraphemeSchema = readonlyObject({
  value: v.string(),
  range: ManuscriptRangeSchema,
});

export type ParsedGrapheme = v.InferOutput<typeof ParsedGraphemeSchema>;

export const RubyAnnotationSchema = readonlyObject({
  kind: v.literal("ruby"),
  range: ManuscriptRangeSchema,
  reading: v.string(),
});
export const BoldAnnotationSchema = readonlyObject({
  kind: v.literal("bold"),
  range: ManuscriptRangeSchema,
});
export const ItalicAnnotationSchema = readonlyObject({
  kind: v.literal("italic"),
  range: ManuscriptRangeSchema,
});
export const EmphasisAnnotationSchema = readonlyObject({
  kind: v.literal("emphasis"),
  range: ManuscriptRangeSchema,
  mark: v.string(),
});

export const ManuscriptAnnotationSchema = v.variant("kind", [
  RubyAnnotationSchema,
  BoldAnnotationSchema,
  ItalicAnnotationSchema,
  EmphasisAnnotationSchema,
]);

export type RubyAnnotation = v.InferOutput<typeof RubyAnnotationSchema>;
export type BoldAnnotation = v.InferOutput<typeof BoldAnnotationSchema>;
export type ItalicAnnotation = v.InferOutput<typeof ItalicAnnotationSchema>;
export type EmphasisAnnotation = v.InferOutput<typeof EmphasisAnnotationSchema>;
export type ManuscriptAnnotation = v.InferOutput<typeof ManuscriptAnnotationSchema>;

export const ParsedManuscriptSchema = readonlyObject({
  source: v.string(),
  displayText: v.string(),
  graphemes: v.pipe(v.array(ParsedGraphemeSchema), v.readonly()),
  annotations: v.pipe(v.array(ManuscriptAnnotationSchema), v.readonly()),
});

export type ParsedManuscript = v.InferOutput<typeof ParsedManuscriptSchema>;

export interface ManuscriptParser {
  readonly id: string;
  parse(source: string): ManuscriptResult<ParsedManuscript>;
}

export interface ParseManuscriptOptions {
  readonly parser?: ManuscriptParser;
}

interface MutableRange {
  source: { start: number; end: number };
  display: { start: number; end: number };
  graphemes: { start: number; end: number };
}

interface MutableParsedGrapheme {
  value: string;
  range: MutableRange;
}

const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

class ParsedManuscriptBuilder {
  readonly #source: string;
  readonly #displayParts: string[] = [];
  readonly graphemes: MutableParsedGrapheme[] = [];
  readonly annotations: unknown[] = [];
  #displayLength = 0;

  constructor(source: string) {
    this.#source = source;
  }

  append(text: string, sourceStart: number): MutableRange {
    const displayStart = this.#displayLength;
    let graphemeStart = this.graphemes.length;
    let unsegmentedStart = 0;
    this.#displayParts.push(text);

    const previous = this.graphemes.at(-1);
    if (previous !== undefined && text.length > 0) {
      const first = segmenter
        .segment(previous.value + text)
        [Symbol.iterator]()
        .next().value;
      const joinedLength = first?.segment.length ?? previous.value.length;
      unsegmentedStart = joinedLength - previous.value.length;
      if (unsegmentedStart > 0) {
        previous.value += text.slice(0, unsegmentedStart);
        previous.range.display.end += unsegmentedStart;
        previous.range.source.end = sourceStart + unsegmentedStart;
        graphemeStart -= 1;
      }
    }

    for (const { index, segment } of segmenter.segment(text.slice(unsegmentedStart))) {
      const graphemeIndex = this.graphemes.length;
      this.graphemes.push({
        value: segment,
        range: {
          source: {
            start: sourceStart + unsegmentedStart + index,
            end: sourceStart + unsegmentedStart + index + segment.length,
          },
          display: {
            start: displayStart + unsegmentedStart + index,
            end: displayStart + unsegmentedStart + index + segment.length,
          },
          graphemes: { start: graphemeIndex, end: graphemeIndex + 1 },
        },
      });
    }
    this.#displayLength += text.length;

    return {
      source: { start: sourceStart, end: sourceStart + text.length },
      display: { start: displayStart, end: this.#displayLength },
      graphemes: { start: Math.max(0, graphemeStart), end: this.graphemes.length },
    };
  }

  build(): ParsedManuscript {
    return v.parse(ParsedManuscriptSchema, {
      source: this.#source,
      displayText: this.#displayParts.join(""),
      graphemes: this.graphemes,
      annotations: this.annotations,
    });
  }
}

function parsePlainText(source: string): ManuscriptResult<ParsedManuscript> {
  const builder = new ParsedManuscriptBuilder(source);
  builder.append(source, 0);
  return success(builder.build());
}

export const plainTextParser: ManuscriptParser = { id: "kg/plain-text", parse: parsePlainText };

interface TrimmedContent {
  readonly text: string;
  readonly sourceStart: number;
}

interface ParsedTag {
  readonly end: number;
  readonly content: TrimmedContent;
  readonly annotation:
    | { readonly kind: "ruby"; readonly reading: string }
    | { readonly kind: "bold" }
    | { readonly kind: "italic" }
    | { readonly kind: "emphasis"; readonly mark: string };
}

function trimContent(text: string, sourceStart: number): TrimmedContent {
  const trimmedStart = text.trimStart();
  const leadingLength = text.length - trimmedStart.length;
  return { text: trimmedStart.trimEnd(), sourceStart: sourceStart + leadingLength };
}

function lineEnd(source: string, start: number): number {
  const lf = source.indexOf("\n", start);
  const cr = source.indexOf("\r", start);
  if (lf === -1) return cr === -1 ? source.length : cr;
  if (cr === -1) return lf;
  return Math.min(lf, cr);
}

function closingIndex(source: string, start: number, closing: string): number | undefined {
  const end = source.indexOf(closing, start);
  return end !== -1 && end < lineEnd(source, start) ? end : undefined;
}

function isFlatContent(text: string): boolean {
  return text.length > 0 && !text.includes("[") && !text.includes("]");
}

function splitPair(
  body: string,
  bodySourceStart: number,
): readonly [TrimmedContent, TrimmedContent] | undefined {
  const separator = body.indexOf(">");
  if (separator === -1 || body.indexOf(">", separator + 1) !== -1) return undefined;
  const left = trimContent(body.slice(0, separator), bodySourceStart);
  const right = trimContent(body.slice(separator + 1), bodySourceStart + separator + 1);
  return isFlatContent(left.text) && isFlatContent(right.text) ? [left, right] : undefined;
}

function parseDoubleBracketTag(
  source: string,
  start: number,
  prefix: "[[rb:" | "[[emphasismark:",
): ParsedTag | undefined {
  if (!source.startsWith(prefix, start)) return undefined;
  const bodyStart = start + prefix.length;
  const closing = closingIndex(source, bodyStart, "]]");
  if (closing === undefined) return undefined;
  const pair = splitPair(source.slice(bodyStart, closing), bodyStart);
  if (pair === undefined) return undefined;
  const [content, value] = pair;
  if (prefix === "[[rb:") {
    return { end: closing + 2, content, annotation: { kind: "ruby", reading: value.text } };
  }
  if (Array.from(segmenter.segment(value.text)).length !== 1) return undefined;
  return { end: closing + 2, content, annotation: { kind: "emphasis", mark: value.text } };
}

function parseStyledTag(
  source: string,
  start: number,
  prefix: "[b:" | "[i:",
): ParsedTag | undefined {
  if (!source.startsWith(prefix, start)) return undefined;
  const bodyStart = start + prefix.length;
  const closing = closingIndex(source, bodyStart, "]");
  if (closing === undefined) return undefined;
  const content = { text: source.slice(bodyStart, closing), sourceStart: bodyStart };
  if (!isFlatContent(content.text)) return undefined;
  return {
    end: closing + 1,
    content,
    annotation: { kind: prefix === "[b:" ? "bold" : "italic" },
  };
}

function parseTag(source: string, start: number): ParsedTag | undefined {
  return (
    parseDoubleBracketTag(source, start, "[[rb:") ??
    parseDoubleBracketTag(source, start, "[[emphasismark:") ??
    parseStyledTag(source, start, "[b:") ??
    parseStyledTag(source, start, "[i:")
  );
}

function literalEnd(source: string, start: number): number {
  const endOfLine = lineEnd(source, start);
  const closing = source.indexOf("]", start + 1);
  if (closing !== -1 && closing < endOfLine) return closing + 1;
  return Math.max(start + 1, endOfLine);
}

function appendAnnotation(
  builder: ParsedManuscriptBuilder,
  tag: ParsedTag,
  sourceStart: number,
): void {
  const range = builder.append(tag.content.text, tag.content.sourceStart);
  const annotationRange = { ...range, source: { start: sourceStart, end: tag.end } };
  builder.annotations.push({ ...tag.annotation, range: annotationRange });
}

function warningRange(manuscript: ParsedManuscript, start: number, end: number): ManuscriptRange {
  const graphemes = manuscript.graphemes.filter(
    ({ range }) => range.source.start < end && range.source.end > start,
  );
  if (graphemes.length === 0) {
    return v.parse(ManuscriptRangeSchema, {
      source: { start, end },
      display: { start: 0, end: 0 },
      graphemes: { start: 0, end: 0 },
    });
  }
  return v.parse(ManuscriptRangeSchema, {
    source: { start, end },
    display: {
      start: graphemes[0]!.range.display.start,
      end: graphemes.at(-1)!.range.display.end,
    },
    graphemes: {
      start: graphemes[0]!.range.graphemes.start,
      end: graphemes.at(-1)!.range.graphemes.end,
    },
  });
}

function parsePixiv(source: string): ManuscriptResult<ParsedManuscript> {
  const builder = new ParsedManuscriptBuilder(source);
  const warningSpans: Array<{ start: number; end: number }> = [];
  let index = 0;
  while (index < source.length) {
    if (source[index] === "[") {
      const tag = parseTag(source, index);
      if (tag !== undefined) {
        appendAnnotation(builder, tag, index);
        index = tag.end;
        continue;
      }
      const end = literalEnd(source, index);
      builder.append(source.slice(index, end), index);
      warningSpans.push({ start: index, end });
      index = end;
      continue;
    }
    const nextTag = source.indexOf("[", index);
    const end = nextTag === -1 ? source.length : nextTag;
    builder.append(source.slice(index, end), index);
    index = end;
  }
  const manuscript = builder.build();
  const warnings = warningSpans.map(({ start, end }, warningIndex) =>
    diagnostic(
      source,
      { kind: "parser", id: "kg/pixiv" },
      "warning",
      `unrecognized-notation-${warningIndex}`,
      "認識できない記法を原文として扱いました",
      warningRange(manuscript, start, end),
    ),
  );
  return success(manuscript, warnings);
}

export const pixivParser: ManuscriptParser = { id: "kg/pixiv", parse: parsePixiv };

function rangeFitsManuscript(range: ManuscriptRange, manuscript: ParsedManuscript): boolean {
  return (
    range.source.start >= 0 &&
    range.source.end >= range.source.start &&
    range.source.end <= manuscript.source.length &&
    range.display.start >= 0 &&
    range.display.end >= range.display.start &&
    range.display.end <= manuscript.displayText.length &&
    range.graphemes.start >= 0 &&
    range.graphemes.end >= range.graphemes.start &&
    range.graphemes.end <= manuscript.graphemes.length
  );
}

export function validateParsedManuscript(
  source: string,
  manuscript: unknown,
): ManuscriptResult<ParsedManuscript> {
  const schema = v.pipe(
    ParsedManuscriptSchema,
    v.check((value) => {
      const text = value.graphemes.map(({ value: grapheme }) => grapheme).join("");
      const sequential = value.graphemes.every(
        ({ range }, index) =>
          range.graphemes.start === index &&
          range.graphemes.end === index + 1 &&
          rangeFitsManuscript(range, value),
      );
      return (
        value.source === source &&
        value.displayText === text &&
        sequential &&
        value.annotations.every(({ range }) => rangeFitsManuscript(range, value))
      );
    }, "parser output must contain consistent source, display, grapheme, and annotation ranges"),
    v.transform((value) => ({
      ...value,
      annotations: [...value.annotations].sort((left, right) => {
        const sourceOrder = left.range.source.start - right.range.source.start;
        if (sourceOrder !== 0) return sourceOrder;
        const endOrder = left.range.source.end - right.range.source.end;
        return endOrder !== 0 ? endOrder : left.kind.localeCompare(right.kind);
      }),
    })),
  );
  const result = v.safeParse(schema, manuscript);
  if (!result.success) {
    return failure("parse", "invalid-parser-output", "parser returned an invalid manuscript");
  }
  return success(result.output);
}

export function parseManuscript(
  source: string,
  options: ParseManuscriptOptions = {},
): ManuscriptResult<ParsedManuscript> {
  const parser = options.parser ?? plainTextParser;
  try {
    const parserId = v.safeParse(
      v.pipe(v.string(), v.nonEmpty(), v.regex(/^[^/]+\/[^/]+$/u)),
      parser.id,
    );
    if (!parserId.success) {
      return failure("parse", "invalid-parser-id", "parser ID must use namespace/name");
    }
    const resultSchema = v.variant("ok", [
      readonlyObject({
        ok: v.literal(true),
        value: ParsedManuscriptSchema,
        warnings: v.pipe(v.array(ManuscriptDiagnosticSchema), v.readonly()),
      }),
      readonlyObject({
        ok: v.literal(false),
        errors: v.pipe(v.array(ManuscriptProcessingErrorSchema), v.readonly()),
      }),
    ]);
    const rawResult: unknown = parser.parse(source);
    const parsedResult = v.safeParse(resultSchema, rawResult);
    if (!parsedResult.success) {
      return failure("parse", "invalid-parser-output", "parser returned an invalid result");
    }
    const result = parsedResult.output;
    if (!result.ok) return result;
    const validated = validateParsedManuscript(source, result.value);
    return validated.ok ? success(validated.value, result.warnings) : validated;
  } catch (error) {
    return failure(
      "parse",
      "parser-failed",
      error instanceof Error ? error.message : "parser failed",
    );
  }
}
