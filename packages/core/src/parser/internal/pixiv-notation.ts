import { graphemeSegmenter } from "../../internal/segmenter";
import { lineEnd } from "./line-end";

type TrimmedContent = Readonly<{ text: string; sourceStart: number }>;

export type PixivTag = Readonly<{
  end: number;
  content: TrimmedContent;
  annotation:
    | Readonly<{ kind: "ruby"; reading: string }>
    | Readonly<{ kind: "bold" }>
    | Readonly<{ kind: "italic" }>
    | Readonly<{ kind: "emphasis"; mark: string }>;
}>;

function trimContent(text: string, sourceStart: number): TrimmedContent {
  const trimmedStart = text.trimStart();
  const leadingLength = text.length - trimmedStart.length;
  return { text: trimmedStart.trimEnd(), sourceStart: sourceStart + leadingLength };
}

function closingIndex(source: string, start: number, closing: string): number | undefined {
  const end = source.indexOf(closing, start);
  return end !== -1 && end < lineEnd(source, start) ? end : undefined;
}

/**
 * Tag bodies hold literal text only; a nested bracket means this is not a well-formed tag.
 */
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

function parsePairTag(
  source: string,
  start: number,
  prefix: "[[rb:" | "[[emphasismark:",
): PixivTag | undefined {
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
  if ([...graphemeSegmenter.segment(value.text)].length !== 1) return undefined;
  return { end: closing + 2, content, annotation: { kind: "emphasis", mark: value.text } };
}

function parseStyledTag(
  source: string,
  start: number,
  prefix: "[b:" | "[i:",
): PixivTag | undefined {
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

export function parsePixivTag(source: string, start: number): PixivTag | undefined {
  return (
    parsePairTag(source, start, "[[rb:") ??
    parsePairTag(source, start, "[[emphasismark:") ??
    parseStyledTag(source, start, "[b:") ??
    parseStyledTag(source, start, "[i:")
  );
}

/**
 * How far an unrecognised `[` run extends before it can be handed back to the reader as text.
 */
export function literalEnd(source: string, start: number): number {
  const endOfLine = lineEnd(source, start);
  const closing = source.indexOf("]", start + 1);
  if (closing !== -1 && closing < endOfLine) return closing + 1;
  return Math.max(start + 1, endOfLine);
}
