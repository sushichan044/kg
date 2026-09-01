import { CLOSING_BRACKETS, OPENING_BRACKETS } from "../../internal/japanese-brackets";
import type { VerticalTextPresentation } from "../vertical-text-presentation";

export type JapaneseCharacterClass =
  | "cl-01"
  | "cl-02"
  | "cl-03"
  | "cl-04"
  | "cl-05"
  | "cl-06"
  | "cl-07"
  | "cl-08"
  | "cl-09"
  | "cl-10"
  | "cl-11"
  | "cl-12"
  | "cl-13"
  | "cl-14"
  | "cl-15"
  | "cl-16"
  | "cl-19"
  | "cl-24"
  | "cl-25"
  | "cl-26"
  | "cl-27"
  | "cl-30";

export type JapaneseCharacter = Readonly<{
  value: string;
  presentation: VerticalTextPresentation["kind"];
}>;

export type SpacingCapacity = Readonly<{ priority: number; amountEm: number }>;

export type PairSpacing = Readonly<{
  kind: "glue" | "kern";
  naturalWidthEm: number;
  shrink?: SpacingCapacity;
  stretch?: SpacingCapacity;
}>;

export type TypographicBoxMetrics = Readonly<{
  advanceEm: number;
  renderOffsetEm: number;
}>;

export type JapaneseTypesettingProfile = Readonly<{
  classify: (character: JapaneseCharacter) => JapaneseCharacterClass;
  boxMetrics: (
    characterClass: JapaneseCharacterClass,
    measuredAdvanceEm: number,
  ) => TypographicBoxMetrics;
  pairSpacing: (left: JapaneseCharacterClass, right: JapaneseCharacterClass) => PairSpacing;
  lineStartSpacing: (first: JapaneseCharacterClass) => PairSpacing | null;
  lineEndSpacing: (last: JapaneseCharacterClass) => PairSpacing | null;
  breakPenalty: (left: JapaneseCharacterClass, right: JapaneseCharacterClass) => number | null;
  canHang: (characterClass: JapaneseCharacterClass) => boolean;
}>;

const OPENING = new Set(`${OPENING_BRACKETS}【〘〝｟«`);
const CLOSING = new Set(`${CLOSING_BRACKETS}】〙〟｠»`);
const HYPHENS = new Set("‐‑⁃–");
const DIVIDING_PUNCTUATION = new Set("！？‼⁇⁈⁉");
const MIDDLE_DOTS = new Set("・：；");
const SMALL_KANA = new Set("ァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎゕゖ");
const ITERATION_MARKS = new Set("ヽヾゝゞ々〻");
const INSEPARABLE = new Set("—―…‥─〳〵");
const PREFIXED_ABBREVIATIONS = new Set("￥＄£#＃");
const POSTFIXED_ABBREVIATIONS = new Set("°′″％‰");
const UNIT_SYMBOLS = new Set(
  "℃℉㎀㎁㎂㎃㎄㎅㎆㎇㎈㎉㎊㎋㎌㎍㎎㎏㎐㎑㎒㎓㎔㎕㎖㎗㎘㎙㎚㎛㎜㎝㎞㎟㎠㎡㎢",
);
const GROUPED_NUMERAL = /^[0-9０-９]$/u;
const HIRAGANA = /^\p{Script=Hiragana}$/u;
const KATAKANA = /^\p{Script=Katakana}$/u;
const WESTERN = /^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}]$/u;

function classify({ value, presentation }: JapaneseCharacter): JapaneseCharacterClass {
  if (presentation === "tate-chu-yoko") return "cl-30";
  if (OPENING.has(value)) return "cl-01";
  if (CLOSING.has(value)) return "cl-02";
  if (HYPHENS.has(value)) return "cl-03";
  if (DIVIDING_PUNCTUATION.has(value)) return "cl-04";
  if (MIDDLE_DOTS.has(value)) return "cl-05";
  if (value === "。" || value === "．") return "cl-06";
  if (value === "、" || value === "，") return "cl-07";
  if (INSEPARABLE.has(value)) return "cl-08";
  if (ITERATION_MARKS.has(value)) return "cl-09";
  if (value === "ー") return "cl-10";
  if (SMALL_KANA.has(value)) return "cl-11";
  if (PREFIXED_ABBREVIATIONS.has(value)) return "cl-12";
  if (POSTFIXED_ABBREVIATIONS.has(value)) return "cl-13";
  if (value === "　") return "cl-14";
  if (HIRAGANA.test(value)) return "cl-15";
  if (KATAKANA.test(value)) return "cl-16";
  if (GROUPED_NUMERAL.test(value)) return "cl-24";
  if (UNIT_SYMBOLS.has(value)) return "cl-25";
  if (value === " ") return "cl-26";
  if (WESTERN.test(value)) return "cl-27";
  return "cl-19";
}

function pairSpacing(left: JapaneseCharacterClass, right: JapaneseCharacterClass): PairSpacing {
  if (left === "cl-08" && right === "cl-08") {
    return { kind: "kern", naturalWidthEm: 0 };
  }
  if ((left === "cl-01" && right === "cl-01") || (left === "cl-02" && right === "cl-02")) {
    return { kind: "kern", naturalWidthEm: -0.5 };
  }

  if (left === "cl-07" || left === "cl-06") {
    return {
      kind: "glue",
      naturalWidthEm: 0.5,
      shrink: { priority: 1, amountEm: 0.5 },
    };
  }

  if (left === "cl-02" || right === "cl-01") {
    return {
      kind: "glue",
      naturalWidthEm: 0.5,
      shrink: { priority: 2, amountEm: 0.5 },
    };
  }

  return {
    kind: "glue",
    naturalWidthEm: 0,
    stretch: { priority: 3, amountEm: 0.25 },
  };
}

function breakPenalty(left: JapaneseCharacterClass, right: JapaneseCharacterClass): number | null {
  if (left === "cl-01" || left === "cl-12") return null;
  if (
    right === "cl-02" ||
    right === "cl-03" ||
    right === "cl-04" ||
    right === "cl-05" ||
    right === "cl-06" ||
    right === "cl-07" ||
    right === "cl-09" ||
    right === "cl-10" ||
    right === "cl-11" ||
    right === "cl-13"
  ) {
    return null;
  }
  if (left === "cl-08" && right === "cl-08") return null;
  return 0;
}

export const defaultJapaneseTypesettingProfile: JapaneseTypesettingProfile = {
  classify,
  boxMetrics: (characterClass, measuredAdvanceEm) => ({
    advanceEm:
      characterClass === "cl-01" ||
      characterClass === "cl-02" ||
      characterClass === "cl-06" ||
      characterClass === "cl-07"
        ? Math.min(0.5, measuredAdvanceEm)
        : measuredAdvanceEm,
    renderOffsetEm: characterClass === "cl-01" ? -0.5 : 0,
  }),
  pairSpacing,
  lineStartSpacing: (first) =>
    first === "cl-01"
      ? {
          kind: "glue",
          naturalWidthEm: 0.5,
          shrink: { priority: 2, amountEm: 0.5 },
        }
      : null,
  lineEndSpacing: (last) =>
    last === "cl-02" || last === "cl-06" || last === "cl-07"
      ? {
          kind: "glue",
          naturalWidthEm: 0.5,
          shrink: { priority: 2, amountEm: 0.5 },
        }
      : null,
  breakPenalty,
  canHang: (characterClass) => characterClass === "cl-07" || characterClass === "cl-06",
};
