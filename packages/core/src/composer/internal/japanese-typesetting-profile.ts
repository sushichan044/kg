import { CLOSING_BRACKETS, OPENING_BRACKETS } from "../../internal/japanese-brackets";
import type { VerticalTextPresentation } from "../vertical-text-presentation";

/**
 * The JLReq character classes (文字クラス) this profile distinguishes. The bare `cl-NN` identifiers are
 * kept rather than descriptive names so the spacing and penalty tables below can be read side by
 * side with the tables in the specification.
 *
 * JLReq defines thirty classes. Math (cl-17, cl-18) and warichu brackets (cl-28, cl-29) are absent
 * because a novel is not set with them. The base-group classes are absent for a different reason: a
 * novel does carry ruby (cl-22, cl-23), but ruby is an annotation the composer positions
 * separately, and `JapaneseCharacter` cannot describe a base group at all — nor a reference mark
 * (cl-20) or a subscripted base (cl-21). A base character is therefore classified here as whatever
 * it is on its own, which for the kanji that usually carries ruby means cl-19.
 *
 * @see https://www.w3.org/TR/jlreq/#character_classes
 */
export type JapaneseCharacterClass =
  // 始め括弧類 — opening brackets.
  | "cl-01"
  // 終わり括弧類 — closing brackets.
  | "cl-02"
  // ハイフン類 — hyphens.
  | "cl-03"
  // 区切り約物 — dividing punctuation, the question and exclamation marks.
  | "cl-04"
  // 中点類 — middle dots.
  | "cl-05"
  // 句点類 — full stops.
  | "cl-06"
  // 読点類 — commas.
  | "cl-07"
  // 分離禁止文字 — characters that must not be split from their own repetition.
  | "cl-08"
  // 繰返し記号 — iteration marks.
  | "cl-09"
  // 長音記号 — the prolonged sound mark.
  | "cl-10"
  // 小書きの仮名 — small kana.
  | "cl-11"
  // 前置省略記号 — prefixed abbreviations such as a currency sign.
  | "cl-12"
  // 後置省略記号 — postfixed abbreviations such as a degree or percent sign.
  | "cl-13"
  // 和字間隔 — the ideographic space.
  | "cl-14"
  // 平仮名 — hiragana.
  | "cl-15"
  // 片仮名 — katakana.
  | "cl-16"
  // 漢字等 — kanji and the like, and the fallback for anything unclassified.
  | "cl-19"
  // 連数字中の文字 — a digit inside a grouped numeral.
  | "cl-24"
  // 単位記号中の文字 — a character inside a unit symbol.
  | "cl-25"
  // 欧文間隔 — the western word space.
  | "cl-26"
  // 欧文用文字 — western characters.
  | "cl-27"
  // 縦中横中の文字 — a character inside a tate-chu-yoko group.
  | "cl-30";

/**
 * A character together with the vertical presentation already chosen for it, because the same
 * character classifies differently inside a tate-chu-yoko group than it does on its own.
 */
export type JapaneseCharacter = Readonly<{
  value: string;
  presentation: VerticalTextPresentation["kind"];
}>;

/**
 * How much a space may give or take during line adjustment (行の調整処理), and in which order. Lower
 * priorities are spent first, following the orders JLReq 3.8.3 and 3.8.4 lay down.
 *
 * Priority 0 means the adjustment is invisible to the reader, so the paragraph optimizer spends it
 * before anything else and charges nothing for it. JLReq 3.1.9 note 2 is what makes such a case
 * possible at all: the half em after a closing bracket, full stop or comma cannot be seen once that
 * character sits at the line end.
 */
export type SpacingCapacity = Readonly<{ priority: number; amountEm: number }>;

/**
 * The space between one character class and the next. `glue` is an アキ the line adjustment may still
 * resize; `kern` is a fixed 詰め that no adjustment touches.
 */
export type PairSpacing = Readonly<{
  kind: "glue" | "kern";
  naturalWidthEm: number;
  shrink?: SpacingCapacity;
  stretch?: SpacingCapacity;
}>;

/**
 * The advance a character occupies on the line, and how far its ink is shifted inside that advance.
 * The two differ for the brackets and punctuation JLReq sets on a half em rather than a full one.
 */
export type TypographicBoxMetrics = Readonly<{
  advanceEm: number;
  renderOffsetEm: number;
}>;

/**
 * The Japanese typesetting rules the composer consults. Everything JLReq-specific lives behind this
 * contract, so the line breaker itself deals only in boxes, spaces and penalties.
 */
export type JapaneseTypesettingProfile = Readonly<{
  classify: (character: JapaneseCharacter) => JapaneseCharacterClass;
  boxMetrics: (
    characterClass: JapaneseCharacterClass,
    measuredAdvanceEm: number,
  ) => TypographicBoxMetrics;
  pairSpacing: (left: JapaneseCharacterClass, right: JapaneseCharacterClass) => PairSpacing;
  lineStartSpacing: (first: JapaneseCharacterClass) => PairSpacing | null;
  lineEndSpacing: (last: JapaneseCharacterClass) => PairSpacing | null;
  /**
   * `null` where a break between two classes is prohibited, otherwise a cost a caller may weigh.
   * The composer only tests for `null` today, so every permitted break is priced at zero.
   */
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

/**
 * Order matters: a character inside a tate-chu-yoko group is cl-30 whatever it would be on its own,
 * and anything left unmatched is cl-19, the class JLReq reserves for kanji and the like.
 */
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

/**
 * The inter-character space JLReq 3.1.2 and 3.1.4 prescribe for each pair, expressed as glue the
 * paragraph optimizer may still resize. Brackets and punctuation are set on a half em, so a pair of
 * them would otherwise leave a full em of white; the kern closes that gap and stays fixed.
 */
function pairSpacing(left: JapaneseCharacterClass, right: JapaneseCharacterClass): PairSpacing {
  // 分離禁止文字 repeated (a 2倍ダッシュ, a 2倍リーダ) must read as one continuous rule.
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

/**
 * `null` removes the break opportunity outright rather than pricing it, because the three rules
 * below are prohibitions and not preferences.
 *
 * Line-end prohibition (行末禁則, JLReq 3.1.8): an opening bracket or a prefixed abbreviation may not
 * be the last character on a line, since it belongs to what follows it.
 *
 * Line-start prohibition (行頭禁則, JLReq 3.1.7): closing brackets, hyphens, dividing punctuation,
 * middle dots, full stops, commas, iteration marks, the prolonged sound mark, small kana and
 * postfixed abbreviations may not open a line.
 *
 * Unbreakable sequences (分割禁止, JLReq 3.1.10): a 分離禁止文字 followed by another one is a single mark set
 * over two ems and must not be split.
 */
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

  /**
   * Opening and closing brackets, full stops and commas are set on a half em (JLReq 3.1.2). A
   * fullwidth opening-bracket glyph draws its ink in the right half of its own em, so halving the
   * advance alone would leave the ink where it was; the render offset pulls it back into the box.
   */
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

  /**
   * An opening bracket at the line head keeps its half em of white so the line starts on the grid
   * (JLReq 3.1.5). That white is shrinkable, which is how a line ends up flush when nothing else
   * can give.
   */
  lineStartSpacing: (first) =>
    first === "cl-01"
      ? {
          kind: "glue",
          naturalWidthEm: 0.5,
          shrink: { priority: 2, amountEm: 0.5 },
        }
      : null,

  /**
   * The half em trailing a closing bracket, full stop or comma at the line end (JLReq 3.1.9).
   * Priority 0: spending it changes nothing the reader can see.
   */
  lineEndSpacing: (last) =>
    last === "cl-02" || last === "cl-06" || last === "cl-07"
      ? {
          kind: "glue",
          naturalWidthEm: 0.5,
          shrink: { priority: 0, amountEm: 0.5 },
        }
      : null,

  breakPenalty,

  /**
   * Hanging punctuation (ぶら下げ組, JLReq 3.8.2) lets a full stop or comma sit outside the text area
   * instead of forcing the line to be respaced. JLReq admits no other class for it.
   */
  canHang: (characterClass) => characterClass === "cl-07" || characterClass === "cl-06",
};
