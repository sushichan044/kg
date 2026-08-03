import type { SourceRange } from "./pagination";

export interface NotationGrapheme {
  grapheme: string;
  textRange: SourceRange;
  sourceRange: SourceRange;
}

export interface GraphemeRange {
  start: number;
  end: number;
}

interface AnnotationBase {
  graphemeRange: GraphemeRange;
  sourceRange: SourceRange;
}

export interface RubyAnnotation extends AnnotationBase {
  kind: "ruby";
  reading: string;
}

export interface BoldAnnotation extends AnnotationBase {
  kind: "bold";
}

export interface ItalicAnnotation extends AnnotationBase {
  kind: "italic";
}

export interface EmphasisAnnotation extends AnnotationBase {
  kind: "emphasis";
  mark: string;
}

export type NotationAnnotation =
  | RubyAnnotation
  | BoldAnnotation
  | ItalicAnnotation
  | EmphasisAnnotation;

export interface ParsedManuscript {
  text: string;
  graphemes: NotationGrapheme[];
  annotations: NotationAnnotation[];
}

export interface ManuscriptNotation {
  readonly id: string;
  parse(source: string): ParsedManuscript;
}

const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

class ParsedManuscriptBuilder {
  readonly #textParts: string[] = [];
  readonly graphemes: NotationGrapheme[] = [];
  readonly annotations: NotationAnnotation[] = [];
  #textLength = 0;

  append(text: string, sourceStart: number): GraphemeRange {
    const start = this.graphemes.length;
    this.#textParts.push(text);

    for (const { index, segment } of segmenter.segment(text)) {
      this.graphemes.push({
        grapheme: segment,
        textRange: {
          start: this.#textLength + index,
          end: this.#textLength + index + segment.length,
        },
        sourceRange: {
          start: sourceStart + index,
          end: sourceStart + index + segment.length,
        },
      });
    }

    this.#textLength += text.length;

    return { start, end: this.graphemes.length };
  }

  build(): ParsedManuscript {
    return {
      text: this.#textParts.join(""),
      graphemes: this.graphemes,
      annotations: this.annotations,
    };
  }
}

function parsePlainText(source: string): ParsedManuscript {
  const builder = new ParsedManuscriptBuilder();
  builder.append(source, 0);

  return builder.build();
}

export const plainTextNotation: ManuscriptNotation = {
  id: "plain",
  parse: parsePlainText,
};

interface TrimmedContent {
  text: string;
  sourceStart: number;
}

interface ParsedTag {
  end: number;
  content: TrimmedContent;
  annotation:
    | { kind: "ruby"; reading: string }
    | { kind: "bold" }
    | { kind: "italic" }
    | { kind: "emphasis"; mark: string };
}

function trimContent(text: string, sourceStart: number): TrimmedContent {
  const trimmedStart = text.trimStart();
  const leadingLength = text.length - trimmedStart.length;

  return {
    text: trimmedStart.trimEnd(),
    sourceStart: sourceStart + leadingLength,
  };
}

function lineEnd(source: string, start: number): number {
  const lf = source.indexOf("\n", start);
  const cr = source.indexOf("\r", start);
  if (lf === -1) {
    return cr === -1 ? source.length : cr;
  }
  if (cr === -1) {
    return lf;
  }

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
): [TrimmedContent, TrimmedContent] | undefined {
  const separator = body.indexOf(">");
  if (separator === -1 || body.indexOf(">", separator + 1) !== -1) {
    return undefined;
  }

  const left = trimContent(body.slice(0, separator), bodySourceStart);
  const right = trimContent(body.slice(separator + 1), bodySourceStart + separator + 1);
  if (!isFlatContent(left.text) || !isFlatContent(right.text)) {
    return undefined;
  }

  return [left, right];
}

function parseDoubleBracketTag(
  source: string,
  start: number,
  prefix: "[[rb:" | "[[emphasismark:",
): ParsedTag | undefined {
  if (!source.startsWith(prefix, start)) {
    return undefined;
  }

  const bodyStart = start + prefix.length;
  const closing = closingIndex(source, bodyStart, "]]");
  if (closing === undefined) {
    return undefined;
  }

  const pair = splitPair(source.slice(bodyStart, closing), bodyStart);
  if (pair === undefined) {
    return undefined;
  }

  const [content, value] = pair;
  if (prefix === "[[rb:") {
    return {
      end: closing + 2,
      content,
      annotation: { kind: "ruby", reading: value.text },
    };
  }

  if (Array.from(segmenter.segment(value.text)).length !== 1) {
    return undefined;
  }

  return {
    end: closing + 2,
    content,
    annotation: { kind: "emphasis", mark: value.text },
  };
}

function parseStyledTag(
  source: string,
  start: number,
  prefix: "[b:" | "[i:",
): ParsedTag | undefined {
  if (!source.startsWith(prefix, start)) {
    return undefined;
  }

  const bodyStart = start + prefix.length;
  const closing = closingIndex(source, bodyStart, "]");
  if (closing === undefined) {
    return undefined;
  }

  const content = { text: source.slice(bodyStart, closing), sourceStart: bodyStart };
  if (!isFlatContent(content.text)) {
    return undefined;
  }

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
  if (closing !== -1 && closing < endOfLine) {
    return closing + 1;
  }

  return Math.max(start + 1, endOfLine);
}

function appendAnnotation(
  builder: ParsedManuscriptBuilder,
  tag: ParsedTag,
  sourceStart: number,
): void {
  const graphemeRange = builder.append(tag.content.text, tag.content.sourceStart);
  const sourceRange = { start: sourceStart, end: tag.end };

  switch (tag.annotation.kind) {
    case "ruby": {
      builder.annotations.push({
        kind: "ruby",
        reading: tag.annotation.reading,
        graphemeRange,
        sourceRange,
      });
      break;
    }
    case "bold": {
      builder.annotations.push({ kind: "bold", graphemeRange, sourceRange });
      break;
    }
    case "italic": {
      builder.annotations.push({ kind: "italic", graphemeRange, sourceRange });
      break;
    }
    case "emphasis": {
      builder.annotations.push({
        kind: "emphasis",
        mark: tag.annotation.mark,
        graphemeRange,
        sourceRange,
      });
      break;
    }
  }
}

function parsePixiv(source: string): ParsedManuscript {
  const builder = new ParsedManuscriptBuilder();
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
      index = end;

      continue;
    }

    const nextTag = source.indexOf("[", index);
    const end = nextTag === -1 ? source.length : nextTag;
    builder.append(source.slice(index, end), index);
    index = end;
  }

  return builder.build();
}

export const pixivNotation: ManuscriptNotation = {
  id: "pixiv",
  parse: parsePixiv,
};
