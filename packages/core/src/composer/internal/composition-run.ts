import { characterClass } from "../../internal/japanese-brackets";
import { TATE_CHU_YOKO_MARKS } from "../../internal/japanese-punctuation";
import type { ParsedGrapheme } from "../../parser/parsed-grapheme";
import { ManuscriptRange } from "../../range/manuscript-range";
import type { PresentationKind } from "../presentation-kind";

const ASCII_ALPHANUMERIC = /^[A-Za-z0-9]$/u;
const ASCII_TWO_DIGITS = /^[0-9]{2}$/u;
const UPRIGHT_LATIN_ABBREVIATION = /^(?:[A-Z]+|[A-Z][a-z]{1,2})$/u;
const TATE_CHU_YOKO_MARK = new RegExp(`^[${characterClass(TATE_CHU_YOKO_MARKS)}]$`, "u");
const FULLWIDTH_ALPHANUMERIC = /^[Ａ-Ｚａ-ｚ０-９]$/u;
const ASCII_TEXT = /^[ -~]$/u;
const ASCII_WORD = /^[!-~]$/u;
const WESTERN_CONTEXT = /[A-Za-z0-9][^A-Za-z0-9]+[A-Za-z0-9]/u;

export type CompositionRun = Readonly<{
  range: ManuscriptRange;
  presentation: PresentationKind;
  members: readonly ParsedGrapheme[];
}>;

function stretchEnd(graphemes: readonly ParsedGrapheme[], start: number, pattern: RegExp): number {
  let end = start + 1;
  while (pattern.test(graphemes[end]?.value ?? "")) end += 1;
  return end;
}

function presentationOf(text: string): PresentationKind {
  if (ASCII_ALPHANUMERIC.test(text[0] ?? "")) {
    if (ASCII_TWO_DIGITS.test(text)) return "tate-chu-yoko";
    return text.length === 1 || UPRIGHT_LATIN_ABBREVIATION.test(text) ? "upright" : "sideways";
  }
  return FULLWIDTH_ALPHANUMERIC.test(text) ? "upright" : "mixed";
}

/**
 * Recognize sentence-wide presentation while keeping words as separate line-break units. Standalone
 * dotted abbreviations retain the existing per-token presentation.
 */
function recognize(graphemes: readonly ParsedGrapheme[]): CompositionRun[] {
  const runs: CompositionRun[] = [];
  const push = (members: readonly ParsedGrapheme[], presentation: PresentationKind) => {
    const range = ManuscriptRange.merge(members.map((member) => member.range));
    if (range !== null) runs.push({ range, presentation, members });
  };
  let cursor = 0;
  let checkedThrough = 0;
  while (cursor < graphemes.length) {
    const first = graphemes[cursor];
    if (first === undefined) break;
    if (cursor >= checkedThrough && ASCII_TEXT.test(first.value)) {
      const contextEnd = stretchEnd(graphemes, cursor, ASCII_TEXT);
      checkedThrough = contextEnd;
      const text = graphemes
        .slice(cursor, contextEnd)
        .map(({ value }) => value)
        .join("");
      const abbreviationParts = text.trim().replace(/\.$/u, "").split(".");
      const standaloneDottedAbbreviation =
        abbreviationParts.length > 1 &&
        abbreviationParts.every((part) => UPRIGHT_LATIN_ABBREVIATION.test(part));
      if (/[A-Za-z]/u.test(text) && WESTERN_CONTEXT.test(text) && !standaloneDottedAbbreviation) {
        // Presentation spans the sentence; only individual words prohibit line breaks.
        while (cursor < contextEnd) {
          const end = ASCII_WORD.test(graphemes[cursor]?.value ?? "")
            ? stretchEnd(graphemes, cursor, ASCII_WORD)
            : cursor + 1;
          push(graphemes.slice(cursor, end), "sideways");
          cursor = end;
        }
        continue;
      }
    }
    if (TATE_CHU_YOKO_MARK.test(first.value)) {
      const end = stretchEnd(graphemes, cursor, TATE_CHU_YOKO_MARK);
      const members = graphemes.slice(cursor, end);
      // A stretch of four or more stays uncombined as a whole, so no 2-3 mark tail is carved out of it.
      if (members.length === 2 || members.length === 3) push(members, "tate-chu-yoko");
      else for (const member of members) push([member], "mixed");
      cursor = end;
      continue;
    }
    const end = ASCII_ALPHANUMERIC.test(first.value)
      ? stretchEnd(graphemes, cursor, ASCII_ALPHANUMERIC)
      : cursor + 1;
    const members = graphemes.slice(cursor, end);
    push(members, presentationOf(members.map(({ value }) => value).join("")));
    cursor = end;
  }
  return runs;
}

export const CompositionRun = {
  recognize,
} as const;
