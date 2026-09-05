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
export const japaneseCharacterClasses = [
  // 始め括弧類 — opening brackets.
  "cl-01",
  // 終わり括弧類 — closing brackets.
  "cl-02",
  // ハイフン類 — hyphens.
  "cl-03",
  // 区切り約物 — dividing punctuation, the question and exclamation marks.
  "cl-04",
  // 中点類 — middle dots.
  "cl-05",
  // 句点類 — full stops.
  "cl-06",
  // 読点類 — commas.
  "cl-07",
  // 分離禁止文字 — characters that must not be split from their own repetition.
  "cl-08",
  // 繰返し記号 — iteration marks.
  "cl-09",
  // 長音記号 — the prolonged sound mark.
  "cl-10",
  // 小書きの仮名 — small kana.
  "cl-11",
  // 前置省略記号 — prefixed abbreviations such as a currency sign.
  "cl-12",
  // 後置省略記号 — postfixed abbreviations such as a degree or percent sign.
  "cl-13",
  // 和字間隔 — the ideographic space.
  "cl-14",
  // 平仮名 — hiragana.
  "cl-15",
  // 片仮名 — katakana.
  "cl-16",
  // 漢字等 — kanji and the like, and the fallback for anything unclassified.
  "cl-19",
  // 連数字中の文字 — a digit inside a grouped numeral.
  "cl-24",
  // 単位記号中の文字 — a character inside a unit symbol.
  "cl-25",
  // 欧文間隔 — the western word space.
  "cl-26",
  // 欧文用文字 — western characters.
  "cl-27",
  // 縦中横中の文字 — a character inside a tate-chu-yoko group.
  "cl-30",
] as const;

export type JapaneseCharacterClass = (typeof japaneseCharacterClasses)[number];

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
 * before anything else and charges nothing for it. JLReq 3.1.9 is what makes such a case possible
 * at all: the half em after a closing bracket, full stop or comma — and the quarter em after a
 * middle dot — cannot be seen once that character sits at the line end.
 *
 * @see REDUCTION_STAGE for the stages JLReq 3.8.3 orders these priorities by.
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
 * Which kind of line head a line begins with (JLReq 3.1.5). 改行行頭 is the head of a line that starts
 * a paragraph; 折返し行頭 is the head of a line the composer turned over. JLReq gives the two different
 * amounts of white before an opening bracket, so the profile has to know which one it is looking
 * at.
 */
export type LineHeadKind = "paragraph-start" | "turned-over";

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
  lineStartSpacing: (first: JapaneseCharacterClass, lineHead: LineHeadKind) => PairSpacing | null;
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
 * The stages JLReq 3.8.3 spends inter-character space in, as glue priorities: the lower the number,
 * the earlier the paragraph optimizer takes it.
 *
 * JLReq's own first stage is the western word space (cl-26), which is absent here because reducing
 * it means resizing the space's own advance rather than a space between two characters.
 *
 * The line-end stage is priority 0, which the optimizer also charges nothing for. JLReq 3.1.9 is
 * what allows that: the half em after a closing bracket, full stop or comma — and the quarter em
 * after a middle dot — cannot be seen once that character sits at the line end. JLReq orders it
 * second rather than first, but only after the word space this profile does not adjust at all.
 * Stages two and three are one priority here because a line has a single line end, so the two never
 * compete.
 */
const REDUCTION_STAGE = {
  /**
   * Stages 2 and 3: the space after a closing bracket, full stop, comma or middle dot at line end.
   */
  lineEnd: 0,
  /**
   * Stage 4: the quarter em on either side of a mid-line middle dot.
   */
  middleDot: 1,
  /**
   * Stage 5: the half em before an opening bracket and after a closing bracket or comma.
   */
  punctuation: 2,
  /**
   * Stage 6: the quarter em between Japanese and a numeral, unit symbol or western character.
   */
  mixedText: 3,
} as const;

/**
 * The stages JLReq 3.8.4 adds inter-character space in, as glue priorities on the same reading as
 * {@link REDUCTION_STAGE}: the lower the number, the earlier the paragraph optimizer takes it. A
 * line is either reduced or expanded, never both, so the two scales never meet.
 *
 * Stage 1 is the western word space (cl-26), absent for the same reason it is absent from the
 * reduction stages. Stage 4 spreads whatever a、b and c could not absorb across every character gap
 * that is not unbreakable, and is deliberately not implemented: it would justify every line that
 * currently falls short, which reads as prose combed out to the margin rather than a novel.
 */
const EXPANSION_STAGE = {
  /**
   * Stage 2: the quarter em between Japanese and a numeral, unit symbol or western character.
   */
  mixedText: 1,
  /**
   * Stage 3: everywhere else 表6 admits, from solid up to a quarter em.
   */
  solid: 2,
} as const;

/**
 * 無印 in 表1 with no colour in 表6: the pair is set solid and line adjustment leaves it alone.
 */
const SOLID: PairSpacing = { kind: "glue", naturalWidthEm: 0 };
/**
 * `1/4` in 表6: set solid, but line adjustment may open it up to a quarter em.
 */
const SOLID_EXPANDABLE: PairSpacing = {
  kind: "glue",
  naturalWidthEm: 0,
  stretch: { priority: EXPANSION_STAGE.solid, amountEm: 0.25 },
};
/**
 * `1/2` in 表1 with `1/2-0` in 表3: a half em that line adjustment may take down to solid.
 */
const HALF: PairSpacing = {
  kind: "glue",
  naturalWidthEm: 0.5,
  shrink: { priority: REDUCTION_STAGE.punctuation, amountEm: 0.5 },
};
/**
 * `1/2` in both tables: the half em exists but is not a reduction opportunity.
 */
const FIXED_HALF: PairSpacing = { kind: "glue", naturalWidthEm: 0.5 };
/**
 * `1/4` in 表1 with `1/4-0` in 表3: a quarter em that may go down to solid.
 */
const QUARTER: PairSpacing = {
  kind: "glue",
  naturalWidthEm: 0.25,
  shrink: { priority: REDUCTION_STAGE.middleDot, amountEm: 0.25 },
};
/**
 * `1/4` in both tables: the quarter em exists but is not a reduction opportunity.
 */
const FIXED_QUARTER: PairSpacing = { kind: "glue", naturalWidthEm: 0.25 };
/**
 * `1/4-1/8` in 表3 with `1/4-1/2` in 表6: the Japanese-to-western quarter em, reducible to an eighth
 * and expandable to a half.
 */
const MIXED_TEXT_QUARTER: PairSpacing = {
  kind: "glue",
  naturalWidthEm: 0.25,
  shrink: { priority: REDUCTION_STAGE.mixedText, amountEm: 0.125 },
  stretch: { priority: EXPANSION_STAGE.mixedText, amountEm: 0.25 },
};
/**
 * The same quarter em where 表6 leaves it out of the expansion: between a unit symbol and the
 * quantity on either side of it.
 */
const UNIT_SYMBOL_QUARTER: PairSpacing = {
  kind: "glue",
  naturalWidthEm: 0.25,
  shrink: { priority: REDUCTION_STAGE.mixedText, amountEm: 0.125 },
};
/**
 * 表1 注3 with 表3 注1: two middle dots meet, and their quarters go solid together.
 */
const TWO_QUARTERS: PairSpacing = {
  kind: "glue",
  naturalWidthEm: 0.5,
  shrink: { priority: REDUCTION_STAGE.middleDot, amountEm: 0.5 },
};
/**
 * 表1 注5 with 表3 注2: a full stop's fixed half em plus the following middle dot's quarter.
 */
const FIXED_HALF_AND_QUARTER: PairSpacing = {
  kind: "glue",
  naturalWidthEm: 0.75,
  shrink: { priority: REDUCTION_STAGE.middleDot, amountEm: 0.25 },
};
/**
 * 表1 注5 with 表3 注3: a comma's half em plus the following middle dot's quarter.
 *
 * 表3 spends the quarter at stage 4 and the half at stage 5, which one capacity cannot say. Both are
 * reducible to solid, so the total is right and only the order collapses — and `、・` is rare enough
 * that the order never shows.
 */
const HALF_AND_QUARTER: PairSpacing = {
  kind: "glue",
  naturalWidthEm: 0.75,
  shrink: { priority: REDUCTION_STAGE.punctuation, amountEm: 0.75 },
};
/**
 * 分離禁止文字 repeated (a 2倍ダッシュ, a 2倍リーダ) must read as one continuous rule (3.1.10).
 */
const DASH_JOINT: PairSpacing = { kind: "kern", naturalWidthEm: 0 };

/**
 * The classes that take a quarter em against a numeral, unit symbol or western character (3.2.6).
 * Dividing punctuation is on the list in that direction only, because the space before a `？` or `！`
 * is solid (3.1.6).
 */
const JAPANESE_BEFORE_WESTERN = [
  "cl-04",
  "cl-09",
  "cl-10",
  "cl-11",
  "cl-15",
  "cl-16",
  "cl-19",
  "cl-30",
] as const;
const JAPANESE_AFTER_WESTERN = [
  "cl-09",
  "cl-10",
  "cl-11",
  "cl-15",
  "cl-16",
  "cl-19",
  "cl-30",
] as const;
const NUMERAL_UNIT_OR_WESTERN = ["cl-24", "cl-25", "cl-27"] as const;
const PUNCTUATION_TAKING_SPACE_AFTER = ["cl-02", "cl-06", "cl-07"] as const;

/**
 * 表6 の色付きの小間: the classes a solid pair may be opened up between at stage 3. Neither list holds a
 * bracket, a middle dot, a full stop, a comma, a hyphen, an ideographic space or a word space —
 * JLReq opens none of those — and only the left-hand list holds a numeral, unit symbol or western
 * character, since the space on their Japanese side belongs to stage 2 instead.
 */
const EXPANDABLE_BEFORE = [
  "cl-08",
  "cl-09",
  "cl-10",
  "cl-11",
  "cl-12",
  "cl-13",
  "cl-15",
  "cl-16",
  "cl-19",
  "cl-24",
  "cl-25",
  "cl-27",
  "cl-30",
] as const;
const EXPANDABLE_AFTER = [
  "cl-08",
  "cl-09",
  "cl-10",
  "cl-11",
  "cl-12",
  "cl-13",
  "cl-15",
  "cl-16",
  "cl-19",
  "cl-30",
] as const;

/**
 * The classes JLReq 3.1.2 sets on a half em rather than a full one.
 */
const HALF_EM_CLASSES = new Set<JapaneseCharacterClass>([
  "cl-01",
  "cl-02",
  "cl-05",
  "cl-06",
  "cl-07",
]);

type ClassSelector = readonly JapaneseCharacterClass[] | "any";

type PairSpacingRule = Readonly<{
  left: ClassSelector;
  right: ClassSelector;
  spacing: PairSpacing;
}>;

/**
 * 附属書 表1（文字間の空き量）and 表3（行の調整処理で詰める処理が可能な箇所）as rows, columns and the exceptions the tables
 * themselves carry. A later rule overrides an earlier one, so each block reads the way the appendix
 * does: a column of the table, then a row, then the cells that break the row.
 *
 * `be` and `af` in 表1 only say whose character size a half or a quarter is measured against, which
 * cannot differ while the composer sets one size, so the notation is reduced to an amount here.
 *
 * @see https://www.w3.org/TR/jlreq/#spacing_between_characters
 * @see https://www.w3.org/TR/jlreq/#opportunities_for_intercharacter_space_reduction_during_line_adjustment
 */
const PAIR_SPACING_RULES: readonly PairSpacingRule[] = [
  { left: "any", right: "any", spacing: SOLID },

  // 表6（行の調整処理で空ける処理が可能な箇所）first, because every rule below it either leaves a pair
  // solid or replaces it with an アキ of its own, and 表6 opens up only pairs that are solid to begin
  // with. The Japanese-to-western quarter em, which 表6 does expand, carries its own capacity.
  { left: EXPANDABLE_BEFORE, right: EXPANDABLE_AFTER, spacing: SOLID_EXPANDABLE },
  // 表6 の cl-24 / cl-25 / cl-27 列: a mark that is neither Japanese nor western may still be opened
  // up against one, 注10 including a percent or degree sign after a western character.
  { left: ["cl-08", "cl-12", "cl-13"], right: NUMERAL_UNIT_OR_WESTERN, spacing: SOLID_EXPANDABLE },
  // The cells 表6 leaves white inside those two blocks. A prefixed abbreviation binds to the numeral
  // it introduces (`￥100`) and 注8 keeps a numeral tight against a postfixed abbreviation (`10％`);
  // for the other two the table gives no reason beyond leaving the cell blank.
  { left: ["cl-08"], right: ["cl-24", "cl-25"], spacing: SOLID },
  { left: ["cl-12"], right: ["cl-24"], spacing: SOLID },
  { left: ["cl-24"], right: ["cl-13"], spacing: SOLID },
  { left: ["cl-09", "cl-10", "cl-11"], right: ["cl-08"], spacing: SOLID },

  // 表1 の cl-01 列: an opening bracket takes a half em before it (3.1.2).
  { left: "any", right: ["cl-01"], spacing: HALF },
  // 表1 の cl-05 列: a middle dot takes a quarter em before it (3.1.2).
  { left: "any", right: ["cl-05"], spacing: QUARTER },
  // 表1 の cl-02 / cl-06 / cl-07 列: the space belongs after those, never before (3.1.4 ①②).
  { left: "any", right: PUNCTUATION_TAKING_SPACE_AFTER, spacing: SOLID },

  // Japanese against a numeral, unit symbol or western character (3.2.6).
  { left: JAPANESE_BEFORE_WESTERN, right: NUMERAL_UNIT_OR_WESTERN, spacing: MIXED_TEXT_QUARTER },
  { left: NUMERAL_UNIT_OR_WESTERN, right: JAPANESE_AFTER_WESTERN, spacing: MIXED_TEXT_QUARTER },
  // 表1 の cl-24 / cl-25 / cl-27 の交差: a unit symbol takes a quarter em against the quantity beside
  // it, which 3.1.10 calls customary for the `4` and the `k` of `4 km` (図2.28). 表6 never expands
  // those, and 表3 leaves the numeral-before-unit quarter out of line adjustment altogether.
  { left: ["cl-25"], right: ["cl-24"], spacing: UNIT_SYMBOL_QUARTER },
  { left: ["cl-27"], right: ["cl-25"], spacing: UNIT_SYMBOL_QUARTER },
  { left: ["cl-24"], right: ["cl-25"], spacing: FIXED_QUARTER },

  // 表1 の cl-02 / cl-07 行: a closing bracket or comma takes a half em after it (3.1.2).
  { left: ["cl-02", "cl-07"], right: "any", spacing: HALF },
  // 表1 の cl-06 行: so does a full stop, but mid-line that half em marks the end of a sentence and
  // JLReq 3.8.3 keeps it out of line adjustment entirely.
  { left: ["cl-06"], right: "any", spacing: FIXED_HALF },
  // 表1 の cl-05 列 again, since the row above would otherwise cover it (表1 注5).
  { left: ["cl-02"], right: ["cl-05"], spacing: QUARTER },
  { left: ["cl-06"], right: ["cl-05"], spacing: FIXED_HALF_AND_QUARTER },
  { left: ["cl-07"], right: ["cl-05"], spacing: HALF_AND_QUARTER },
  // Consecutive punctuation sets solid and the trailing half em is taken once (3.1.4 ①②⑥).
  {
    left: PUNCTUATION_TAKING_SPACE_AFTER,
    right: PUNCTUATION_TAKING_SPACE_AFTER,
    spacing: SOLID,
  },
  // 表1 の cl-02 行 cl-14 列: an ideographic space after a closing bracket absorbs the half em.
  { left: ["cl-02"], right: ["cl-14"], spacing: SOLID },

  // 表1 の cl-05 行: a middle dot takes a quarter em after it as well (3.1.2), which is why a middle
  // dot is a half-em box with a quarter on each side and still occupies one em.
  { left: ["cl-05"], right: "any", spacing: QUARTER },
  { left: ["cl-05"], right: ["cl-05"], spacing: TWO_QUARTERS },

  // 表1 の cl-01 行: nothing follows an opening bracket, since its space sits before it (3.1.4 ⑤).
  { left: ["cl-01"], right: "any", spacing: SOLID },
  { left: ["cl-01"], right: ["cl-05"], spacing: QUARTER },

  // 表1 の cl-14 行: an ideographic space is itself the space, so it needs none after it.
  { left: ["cl-14"], right: "any", spacing: SOLID },
  { left: ["cl-14"], right: ["cl-05"], spacing: QUARTER },

  // 表1 の cl-26 行と cl-26 列: a western word space is set solid against its neighbours, except for
  // the half em an opening bracket and the quarter em a middle dot always take. 表3 marks no cell of
  // that row or column as a reduction opportunity, so every space beside a word space is fixed —
  // adjusting the word space itself is JLReq's first stage, which this profile does not do yet.
  { left: "any", right: ["cl-26"], spacing: SOLID },
  { left: PUNCTUATION_TAKING_SPACE_AFTER, right: ["cl-26"], spacing: FIXED_HALF },
  { left: ["cl-05"], right: ["cl-26"], spacing: FIXED_QUARTER },
  { left: ["cl-26"], right: "any", spacing: SOLID },
  { left: ["cl-26"], right: ["cl-01"], spacing: FIXED_HALF },
  { left: ["cl-26"], right: ["cl-05"], spacing: FIXED_QUARTER },

  { left: ["cl-08"], right: ["cl-08"], spacing: DASH_JOINT },
];

const PAIR_SPACING_TABLE: ReadonlyMap<string, PairSpacing> = new Map(
  PAIR_SPACING_RULES.flatMap(({ left, right, spacing }) =>
    (left === "any" ? japaneseCharacterClasses : left).flatMap((leftClass) =>
      (right === "any" ? japaneseCharacterClasses : right).map(
        (rightClass) => [`${leftClass}/${rightClass}`, spacing] as const,
      ),
    ),
  ),
);

function pairSpacing(left: JapaneseCharacterClass, right: JapaneseCharacterClass): PairSpacing {
  return PAIR_SPACING_TABLE.get(`${left}/${right}`) ?? SOLID;
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
   * Opening and closing brackets, full stops, commas and middle dots are set on a half em (JLReq
   * 3.1.2); the space the pair table puts around them is what brings each back to a full em.
   *
   * A fullwidth glyph keeps drawing its ink where the font put it, so halving the advance alone
   * would leave the ink outside the box. The offset pulls it back: an opening bracket draws in the
   * trailing half of its em, a middle dot in the centre, and the rest in the leading half.
   */
  boxMetrics: (characterClass, measuredAdvanceEm) => {
    const advanceEm = HALF_EM_CLASSES.has(characterClass)
      ? Math.min(0.5, measuredAdvanceEm)
      : measuredAdvanceEm;
    const inkOverhangEm = measuredAdvanceEm - advanceEm;

    return {
      advanceEm,
      renderOffsetEm:
        characterClass === "cl-01"
          ? -inkOverhangEm
          : characterClass === "cl-05"
            ? -inkOverhangEm / 2
            : 0,
    };
  },
  pairSpacing,

  /**
   * The white before an opening bracket at a line head. JLReq 3.1.5 pairs 改行行頭 with 折返し行頭 and lists
   * three schemes for the two together: ① 全角アキ and 天付き, ② 全角半アキ and 二分アキ, ③ 二分アキ and 天付き. This
   * profile takes ③, the scheme 講談社, 新潮社, 文藝春秋, 中央公論新社 and 筑摩書房 set novels with; ① is what JIS X
   * 4051 and 岩波書店 use. A line of dialogue therefore starts one half em in when it opens a
   * paragraph, and flush against the edge when the composer turned it over.
   *
   * The white is not shrinkable. 表3 excludes the line head from line adjustment altogether, and
   * shrinking it is exactly what pushed a line-head bracket flush against the edge in #94.
   */
  lineStartSpacing: (first, lineHead) =>
    first === "cl-01" && lineHead === "paragraph-start"
      ? { kind: "glue", naturalWidthEm: 0.5 }
      : null,

  /**
   * The half em trailing a closing bracket, full stop or comma at the line end, and the quarter em
   * trailing a middle dot there (JLReq 3.1.9). Priority 0: spending it changes nothing the reader
   * can see.
   */
  lineEndSpacing: (last) =>
    last === "cl-02" || last === "cl-06" || last === "cl-07"
      ? {
          kind: "glue",
          naturalWidthEm: 0.5,
          shrink: { priority: REDUCTION_STAGE.lineEnd, amountEm: 0.5 },
        }
      : last === "cl-05"
        ? {
            kind: "glue",
            naturalWidthEm: 0.25,
            shrink: { priority: REDUCTION_STAGE.lineEnd, amountEm: 0.25 },
          }
        : null,

  breakPenalty,

  /**
   * Hanging punctuation (ぶら下げ組, JLReq 3.8.2) lets a full stop or comma sit outside the text area
   * instead of forcing the line to be respaced. JLReq admits no other class for it.
   */
  canHang: (characterClass) => characterClass === "cl-07" || characterClass === "cl-06",
};
