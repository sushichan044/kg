import { graphemeSegmenter } from "../internal/segmenter";
import { NamespacedId } from "../namespaced-id";
import { ManuscriptResult } from "../result/manuscript-result";
import { lineEnd } from "./internal/line-end";
import { createManuscriptDraft } from "./internal/manuscript-draft";
import { unrecognizedNotationWarnings } from "./internal/notation-warning";
import type { UnrecognizedSpan } from "./internal/notation-warning";
import type { ManuscriptParser } from "./manuscript-parser";

const PARSER_ID = NamespacedId.of("kg/kakuyomu");
const MAX_BASE_GRAPHEMES = 20;
const MAX_READING_GRAPHEMES = 50;
const HAN = /^\p{Script=Han}$/u;

type RubyNotation = Readonly<{
  parentStart: number;
  parentEnd: number;
  reading: string;
  end: number;
}>;
type EmphasisNotation = Readonly<{ contentStart: number; contentEnd: number; end: number }>;

function graphemeLength(text: string): number {
  return [...graphemeSegmenter.segment(text)].length;
}

function validRuby(parent: string, reading: string): boolean {
  return (
    parent.length > 0 &&
    reading.length > 0 &&
    !parent.includes("《") &&
    !parent.includes("》") &&
    !reading.includes("《") &&
    !reading.includes("》") &&
    graphemeLength(parent) <= MAX_BASE_GRAPHEMES &&
    graphemeLength(reading) <= MAX_READING_GRAPHEMES
  );
}

function parseRuby(
  source: string,
  parentStart: number,
  parentEnd: number,
  opening: number,
): RubyNotation | undefined {
  const endOfLine = lineEnd(source, opening);
  const closing = source.indexOf("》", opening + 1);
  if (closing === -1 || closing >= endOfLine) return undefined;

  const parent = source.slice(parentStart, parentEnd);
  const reading = source.slice(opening + 1, closing);
  if (!validRuby(parent, reading)) return undefined;

  return { parentStart, parentEnd, reading, end: closing + 1 };
}

function parseExplicitRuby(source: string, start: number): RubyNotation | undefined {
  const endOfLine = lineEnd(source, start + 1);
  const opening = source.indexOf("《", start + 1);
  if (opening === -1 || opening >= endOfLine) return undefined;
  return parseRuby(source, start + 1, opening, opening);
}

function parseEmphasis(source: string, start: number): EmphasisNotation | undefined {
  const endOfLine = lineEnd(source, start + 2);
  const closing = source.indexOf("》》", start + 2);
  if (closing === -1 || closing >= endOfLine) return undefined;

  const content = source.slice(start + 2, closing);
  if (content.length === 0 || content.includes("《") || content.includes("》")) return undefined;
  return { contentStart: start + 2, contentEnd: closing, end: closing + 2 };
}

function codePointLength(source: string, index: number): number {
  const codePoint = source.codePointAt(index);
  return codePoint === undefined || codePoint <= 0xffff ? 1 : 2;
}

function isHanAt(source: string, index: number): boolean {
  return HAN.test(source.slice(index, index + codePointLength(source, index)));
}

function invalidNotationEnd(source: string, start: number): number {
  return lineEnd(source, start + 1);
}

/**
 * Understands Kakuyomu's ruby and emphasis-mark notation. Invalid notation stays literal so source
 * ranges remain inspectable, while clear notation candidates receive a parser warning.
 */
export const kakuyomuParser: ManuscriptParser = {
  id: PARSER_ID,

  parse: (source) => {
    const draft = createManuscriptDraft(source);
    const unrecognized: UnrecognizedSpan[] = [];
    let index = 0;
    let literalStart = 0;
    let hanRunStart = -1;

    const appendBefore = (end: number) => {
      if (literalStart < end) draft.append(source.slice(literalStart, end), literalStart);
    };
    const appendNotationWarning = (start: number, end: number) => {
      unrecognized.push({ start, end });
    };

    while (index < source.length) {
      const character = source[index];
      if (character === "｜" || character === "|") {
        if (source[index + 1] === "《") {
          appendBefore(index);
          draft.append("《", index + 1);
          index += 2;
          literalStart = index;
          hanRunStart = -1;
          continue;
        }

        const ruby = parseExplicitRuby(source, index);
        if (ruby !== undefined) {
          appendBefore(index);
          const range = draft.append(
            source.slice(ruby.parentStart, ruby.parentEnd),
            ruby.parentStart,
          );
          draft.annotate({
            kind: "ruby",
            reading: { kind: "group", text: ruby.reading },
            range: { ...range, source: { start: index, end: ruby.end } },
          });
          index = ruby.end;
          literalStart = index;
          hanRunStart = -1;
          continue;
        }

        const opening = source.indexOf("《", index + 1);
        if (opening !== -1 && opening < lineEnd(source, index + 1)) {
          const end = invalidNotationEnd(source, index);
          appendNotationWarning(index, end);
          index = end;
          hanRunStart = -1;
          continue;
        }
      }

      if (character === "《") {
        const emphasis = source.startsWith("《《", index)
          ? parseEmphasis(source, index)
          : undefined;
        if (emphasis !== undefined) {
          appendBefore(index);
          const range = draft.append(
            source.slice(emphasis.contentStart, emphasis.contentEnd),
            emphasis.contentStart,
          );
          draft.annotate({
            kind: "emphasis",
            mark: "・",
            range: { ...range, source: { start: index, end: emphasis.end } },
          });
          index = emphasis.end;
          literalStart = index;
          hanRunStart = -1;
          continue;
        }

        const ruby = hanRunStart === -1 ? undefined : parseRuby(source, hanRunStart, index, index);
        if (ruby !== undefined) {
          appendBefore(hanRunStart);
          const range = draft.append(
            source.slice(ruby.parentStart, ruby.parentEnd),
            ruby.parentStart,
          );
          draft.annotate({
            kind: "ruby",
            reading: { kind: "group", text: ruby.reading },
            range: { ...range, source: { start: ruby.parentStart, end: ruby.end } },
          });
          index = ruby.end;
          literalStart = index;
          hanRunStart = -1;
          continue;
        }

        if (source.startsWith("《《", index) || hanRunStart !== -1) {
          appendNotationWarning(
            hanRunStart === -1 ? index : hanRunStart,
            invalidNotationEnd(source, index),
          );
        }
        hanRunStart = -1;
      } else if (isHanAt(source, index)) {
        if (hanRunStart === -1) hanRunStart = index;
      } else {
        hanRunStart = -1;
      }

      index += codePointLength(source, index);
    }

    appendBefore(source.length);
    const manuscript = draft.build();
    return ManuscriptResult.succeed(
      manuscript,
      unrecognizedNotationWarnings(source, PARSER_ID, manuscript, unrecognized),
    );
  },
};
