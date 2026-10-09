import type { ParsedGrapheme } from "../../parser/parsed-grapheme";
import { ManuscriptRange } from "../../range/manuscript-range";
import type { PresentationKind } from "../presentation-kind";

const ASCII_ALPHANUMERIC = /^[A-Za-z0-9]$/u;
const ASCII_TWO_DIGITS = /^[0-9]{2}$/u;
const UPRIGHT_LATIN_ABBREVIATION = /^(?:[A-Z]+|[A-Z][a-z]{1,2})$/u;
const FULLWIDTH_ALPHANUMERIC = /^[Ａ-Ｚａ-ｚ０-９]$/u;

export type CompositionRun = Readonly<{
  range: ManuscriptRange;
  presentation: PresentationKind;
  members: readonly ParsedGrapheme[];
}>;

function recognize(graphemes: readonly ParsedGrapheme[]): CompositionRun[] {
  const runs: CompositionRun[] = [];
  let cursor = 0;
  while (cursor < graphemes.length) {
    const first = graphemes[cursor];
    if (first === undefined) break;
    const start = cursor;
    cursor += 1;
    const ascii = ASCII_ALPHANUMERIC.test(first.value);
    if (ascii) {
      while (ASCII_ALPHANUMERIC.test(graphemes[cursor]?.value ?? "")) cursor += 1;
    }
    const members = graphemes.slice(start, cursor);
    const text = members.map(({ value }) => value).join("");
    const presentation = ascii
      ? ASCII_TWO_DIGITS.test(text)
        ? "tate-chu-yoko"
        : text.length === 1 || UPRIGHT_LATIN_ABBREVIATION.test(text)
          ? "upright"
          : "sideways"
      : FULLWIDTH_ALPHANUMERIC.test(first.value)
        ? "upright"
        : "mixed";
    const range = ManuscriptRange.merge(members.map((member) => member.range));
    if (range !== null) runs.push({ range, presentation, members });
  }
  return runs;
}

export const CompositionRun = {
  recognize,
} as const;
