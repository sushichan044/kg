import { CLOSING_BRACKETS, OPENING_BRACKETS } from "../../internal/japanese-brackets";
import { DIVIDING_PUNCTUATION } from "../../internal/japanese-punctuation";
import type { PresentationKind } from "../presentation-kind";

/**
 * The JLReq character classes (文字クラス) these rules distinguish. The bare `cl-NN` identifiers are
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

export type JapaneseBoundaryClass = JapaneseCharacterClass | "cl-22" | "cl-23";
const boundaryClasses = [...japaneseCharacterClasses, "cl-22", "cl-23"] as const;

/**
 * A character together with the vertical presentation already chosen for it, because the same
 * character classifies differently inside a tate-chu-yoko group than it does on its own.
 */
export type JapaneseCharacter = Readonly<{
  value: string;
  presentation: PresentationKind;
}>;

export type AdjustmentCategory =
  | "line-end"
  | "word-space"
  | "middle-dot"
  | "punctuation"
  | "mixed-text"
  | "solid";

export type RuleSpacingCapacity = Readonly<{
  category: AdjustmentCategory;
  amountEm: number;
  granularity: "continuous" | "all-or-nothing";
}>;

export type RuleSpacing = Readonly<{
  kind: "glue" | "kern";
  naturalWidthEm: number;
  shrink?: RuleSpacingCapacity;
  stretch?: RuleSpacingCapacity;
}>;

export type RuleCharacterSpacing = RuleSpacing & Readonly<{ kind: "glue" }>;
export type LineHeadKind = "paragraph-start" | "turned-over";
export type LinePosition = "line-edge" | "mid-line";
export type RuleLineEndSpacing = Readonly<{
  spacing: RuleSpacing;
  absorbsPrecedingEm: number;
}>;
export type TypographicBoxMetrics = Readonly<{
  advanceEm: number;
  renderOffsetEm: number;
}>;

export type JapaneseTypesettingRules = Readonly<{
  classify: (character: JapaneseCharacter) => JapaneseCharacterClass;
  boxMetrics: (
    characterClass: JapaneseCharacterClass,
    measuredAdvanceEm: number,
  ) => TypographicBoxMetrics;
  pairSpacing: (left: JapaneseBoundaryClass, right: JapaneseBoundaryClass) => RuleSpacing;
  /**
   * The アキ a character _is_, rather than the box it sets in, or `null` for every class that sets as
   * a glyph. 欧文間隔 (cl-26) is the only class JLReq treats this way: it carries no ink, its width is
   * stated by rule rather than measured, and the line adjustment resizes it before anything else.
   */
  spacingCharacter: (
    characterClass: JapaneseCharacterClass,
    position: LinePosition,
  ) => RuleCharacterSpacing | null;
  lineEndSpacing: (last: JapaneseBoundaryClass) => RuleLineEndSpacing | null;
  /**
   * Whether the pair participates in JLReq 3.8.4's final expansion stage. This is independent of
   * line-breaking permission: 表6 admits some mid-line gaps that a kinsoku rule would not admit as a
   * break boundary.
   */
  canExpandAtFinalStage: (left: JapaneseBoundaryClass, right: JapaneseBoundaryClass) => boolean;
  /**
   * `null` where a break between two classes is prohibited, otherwise a cost a caller may weigh.
   * The composer only tests for `null` today, so every permitted break is priced at zero.
   */
  breakPenalty: (left: JapaneseBoundaryClass, right: JapaneseBoundaryClass) => number | null;
  canHang: (characterClass: JapaneseBoundaryClass) => boolean;
}>;

const OPENING = new Set(`${OPENING_BRACKETS}【〘〝｟«`);
const CLOSING = new Set(`${CLOSING_BRACKETS}】〙〟｠»`);
const HYPHENS = new Set("‐‑⁃–");
const DIVIDING_MARKS = new Set(DIVIDING_PUNCTUATION);
const MIDDLE_DOTS = new Set("・：；");
const SMALL_KANA = new Set("ァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎゕゖ");
const ITERATION_MARKS = new Set("ヽヾゝゞ々〻");
const INSEPARABLE = new Set("—―…‥─〳〴〵");
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
 * Order matters: a character inside a tate-chu-yoko group is cl-30 (3.2.5) and an upright Latin
 * letter or Arabic numeral is cl-19 (3.2.4), whatever either would be on its own; anything left
 * unmatched is cl-19 too, the class JLReq reserves for kanji and the like.
 *
 * The quarter em 3.2.6 sets between Japanese and a Western character or numeral applies only to a
 * character rotated 90 degrees in vertical writing mode or mixed into horizontal writing mode —
 * 3.2.6 states that scope explicitly. A character set upright keeps its own rule, 3.2.4, which
 * reads it as a full-width monospace glyph classed with kanji and set solid against its neighbours,
 * the same as a tate-chu-yoko run's 3.2.5.
 */
function classify({ value, presentation }: JapaneseCharacter): JapaneseCharacterClass {
  if (presentation === "tate-chu-yoko") return "cl-30";
  if (presentation === "upright") return "cl-19";
  if (OPENING.has(value)) return "cl-01";
  if (CLOSING.has(value)) return "cl-02";
  if (HYPHENS.has(value)) return "cl-03";
  if (DIVIDING_MARKS.has(value)) return "cl-04";
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
 * 無印 in 表1 with no colour in 表6: the pair is set solid and line adjustment leaves it alone.
 */
const SOLID: RuleSpacing = { kind: "glue", naturalWidthEm: 0 };
/**
 * `1/4` in 表6: set solid, but line adjustment may open it up to a quarter em.
 */
const SOLID_EXPANDABLE: RuleSpacing = {
  kind: "glue",
  naturalWidthEm: 0,
  stretch: { category: "solid", amountEm: 0.25, granularity: "continuous" },
};
/**
 * `1/2` in 表1 with `1/2-0` in 表3: a half em that line adjustment may take down to solid.
 */
const HALF: RuleSpacing = {
  kind: "glue",
  naturalWidthEm: 0.5,
  shrink: { category: "punctuation", amountEm: 0.5, granularity: "continuous" },
};
/**
 * `1/2` in both tables: the half em exists but is not a reduction opportunity.
 */
const FIXED_HALF: RuleSpacing = { kind: "glue", naturalWidthEm: 0.5 };
/**
 * `1/4` in 表1 with `1/4-0` in 表3: a quarter em that may go down to solid.
 */
const QUARTER: RuleSpacing = {
  kind: "glue",
  naturalWidthEm: 0.25,
  shrink: { category: "middle-dot", amountEm: 0.25, granularity: "continuous" },
};
/**
 * `1/4` in both tables: the quarter em exists but is not a reduction opportunity.
 */
const FIXED_QUARTER: RuleSpacing = { kind: "glue", naturalWidthEm: 0.25 };
/**
 * `1/4-1/8` in 表3 with `1/4-1/2` in 表6: the Japanese-to-western quarter em, reducible to an eighth
 * and expandable to a half. 3.2.6 sets this only against a Western character rotated 90 degrees or
 * mixed into horizontal text (cl-27) and a numeral or unit symbol (cl-24, cl-25); an upright
 * Western character classifies as cl-19 instead and never reaches this constant.
 */
const MIXED_TEXT_QUARTER: RuleSpacing = {
  kind: "glue",
  naturalWidthEm: 0.25,
  shrink: { category: "mixed-text", amountEm: 0.125, granularity: "continuous" },
  stretch: { category: "mixed-text", amountEm: 0.25, granularity: "continuous" },
};
/**
 * The same quarter em where 表6 leaves it out of the expansion: between a unit symbol and the
 * quantity on either side of it.
 */
const UNIT_SYMBOL_QUARTER: RuleSpacing = {
  kind: "glue",
  naturalWidthEm: 0.25,
  shrink: { category: "mixed-text", amountEm: 0.125, granularity: "continuous" },
};
/**
 * 表1 注3 with 表3 注1: two middle dots meet, and their quarters go solid together.
 */
const TWO_QUARTERS: RuleSpacing = {
  kind: "glue",
  naturalWidthEm: 0.5,
  shrink: { category: "middle-dot", amountEm: 0.5, granularity: "continuous" },
};
/**
 * 表1 注5 with 表3 注2: a full stop's fixed half em plus the following middle dot's quarter.
 */
const FIXED_HALF_AND_QUARTER: RuleSpacing = {
  kind: "glue",
  naturalWidthEm: 0.75,
  shrink: { category: "middle-dot", amountEm: 0.25, granularity: "continuous" },
};
/**
 * 表1 注5 with 表3 注3: a comma's half em plus the following middle dot's quarter.
 *
 * 表3 spends the quarter at stage 4 and the half at stage 5, which one capacity cannot say. Both are
 * reducible to solid, so the total is right and only the order collapses — and `、・` is rare enough
 * that the order never shows.
 */
const HALF_AND_QUARTER: RuleSpacing = {
  kind: "glue",
  naturalWidthEm: 0.75,
  shrink: { category: "punctuation", amountEm: 0.75, granularity: "continuous" },
};
/**
 * 欧文間隔（cl-26）の三分アキ. JLReq states the western word space as a third em by rule rather than by
 * measurement, and makes it the first space a line adjustment reaches for: down to a 四分アキ when the
 * line is over (3.8.3 a), up to a 二分アキ when it is short (3.8.4 a).
 *
 * The two capacities are written as differences from the limits rather than as `1/12` and `1/6`,
 * because a third of an em is not representable in binary while the limits JLReq states are: this
 * way `naturalWidthEm - shrink.amountEm` is exactly 0.25 and `naturalWidthEm + stretch.amountEm`
 * exactly 0.5.
 */
const WORD_SPACE: RuleCharacterSpacing = {
  kind: "glue",
  naturalWidthEm: 1 / 3,
  shrink: {
    category: "word-space",
    amountEm: 1 / 3 - 1 / 4,
    granularity: "continuous",
  },
  stretch: {
    category: "word-space",
    amountEm: 1 / 2 - 1 / 3,
    granularity: "continuous",
  },
};
/**
 * 表1 注13 と 表3 注4: a word space at a line head or a line end has no width and is no adjustment
 * opportunity, since the white would fall outside the text area where no reader can see it. 注13
 * adds ただし，この部分が移動し，これとは異なる配置になった場合は，欧文間隔（cl-26）の空き量を確保する — which is why the answer is given per
 * candidate line and not once per source line.
 */
const EDGE_WORD_SPACE: RuleCharacterSpacing = { kind: "glue", naturalWidthEm: 0 };

/**
 * The classes that take a quarter em against a numeral, unit symbol or western character rotated 90
 * degrees or mixed into horizontal text (3.2.6) — an upright western character classifies as cl-19
 * and is covered by the general kanji rows and columns instead. Dividing punctuation is on the list
 * in that direction only, because the space before a `？` or `！` is solid (3.1.6).
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
  "cl-22",
  "cl-23",
] as const;
const JAPANESE_AFTER_WESTERN = [
  "cl-09",
  "cl-10",
  "cl-11",
  "cl-15",
  "cl-16",
  "cl-19",
  "cl-30",
  "cl-22",
  "cl-23",
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
  "cl-22",
  "cl-23",
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
  "cl-22",
  "cl-23",
] as const;

/**
 * The gray, blue and pink cells of 表6: all pairs that join the fourth and final expansion stage.
 * The finite capacities above cover the blue and pink cells at stages three and two; once those
 * stages are exhausted, JLReq 3.8.4 d adds the remainder equally across every cell named here.
 *
 * A cl-08/cl-08 cell is blue only for different kinds of mark (注4). BoundaryRule excludes binding
 * sequences using the original character values.
 */
const FINAL_EXPANSION_BASIC_AFTER = new Set<JapaneseCharacterClass>([
  "cl-01",
  "cl-08",
  "cl-12",
  "cl-13",
  "cl-14",
  "cl-15",
  "cl-16",
  "cl-19",
  "cl-24",
  "cl-25",
  "cl-26",
  "cl-27",
  "cl-30",
]);
const FINAL_EXPANSION_WIDE_AFTER = new Set<JapaneseCharacterClass>([
  ...FINAL_EXPANSION_BASIC_AFTER,
  "cl-09",
  "cl-10",
  "cl-11",
]);
const FINAL_EXPANSION_AFTER = new Map<JapaneseCharacterClass, ReadonlySet<JapaneseCharacterClass>>([
  ...(["cl-02", "cl-03", "cl-04", "cl-05", "cl-06", "cl-07", "cl-14"] as const).map(
    (left) => [left, FINAL_EXPANSION_BASIC_AFTER] as const,
  ),
  ...(["cl-09", "cl-10", "cl-11", "cl-13", "cl-15", "cl-16", "cl-19", "cl-30"] as const).map(
    (left) => [left, FINAL_EXPANSION_WIDE_AFTER] as const,
  ),
  ["cl-08", FINAL_EXPANSION_WIDE_AFTER],
  [
    "cl-12",
    new Set([
      "cl-08",
      "cl-09",
      "cl-10",
      "cl-11",
      "cl-12",
      "cl-13",
      "cl-15",
      "cl-16",
      "cl-19",
      "cl-25",
      "cl-26",
      "cl-27",
      "cl-30",
    ]),
  ],
  [
    "cl-24",
    new Set([
      "cl-01",
      "cl-08",
      "cl-09",
      "cl-10",
      "cl-11",
      "cl-12",
      "cl-14",
      "cl-15",
      "cl-16",
      "cl-19",
      "cl-25",
      "cl-26",
      "cl-30",
    ]),
  ],
  [
    "cl-25",
    new Set([
      "cl-01",
      "cl-08",
      "cl-09",
      "cl-10",
      "cl-11",
      "cl-12",
      "cl-13",
      "cl-14",
      "cl-15",
      "cl-16",
      "cl-19",
      "cl-24",
      "cl-26",
      "cl-30",
    ]),
  ],
  [
    "cl-26",
    new Set(japaneseCharacterClasses.filter((characterClass) => characterClass !== "cl-02")),
  ],
  [
    "cl-27",
    new Set([
      "cl-01",
      "cl-08",
      "cl-09",
      "cl-10",
      "cl-11",
      "cl-12",
      "cl-13",
      "cl-14",
      "cl-15",
      "cl-16",
      "cl-19",
      "cl-26",
      "cl-30",
    ]),
  ],
]);

function canExpandAtFinalStage(left: JapaneseBoundaryClass, right: JapaneseBoundaryClass): boolean {
  // Explicit spaces supply their own width, and a horizontal western run (cl-27) reads as one word
  // rather than as independent Japanese cells. Adding another unbounded boundary beside either
  // produces double space or a hole disproportionate to the run's own length.
  if (
    left === "cl-14" ||
    left === "cl-26" ||
    left === "cl-27" ||
    right === "cl-14" ||
    right === "cl-26" ||
    right === "cl-27"
  ) {
    return false;
  }
  // Ruby complexes share the ordinary Japanese final-stage cells. Membership
  // restrictions are resolved by BoundaryRule before these numeric capacities are used.
  const leftClass = left === "cl-22" || left === "cl-23" ? "cl-19" : left;
  const rightClass = right === "cl-22" || right === "cl-23" ? "cl-19" : right;
  if (FINAL_EXPANSION_AFTER.get(leftClass)?.has(rightClass) !== true) return false;

  // A pair with intrinsic white already carries punctuation or mixed-text semantics. Its finite
  // stage, where one exists, is the upper bound; only pairs set solid at rest take the final stage.
  return pairSpacing(left, right).naturalWidthEm === 0;
}

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

type ClassSelector = readonly JapaneseBoundaryClass[] | "any";

type PairSpacingRule = Readonly<{
  left: ClassSelector;
  right: ClassSelector;
  spacing: RuleSpacing;
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
  // that row or column as a reduction opportunity, and its preamble says why: the first stage of the
  // adjustment is the word space's own width, and the table sets out 「優先順位の第2段階以降の処理」 only. The
  // word space is therefore narrowed by `spacingCharacter`, and the spaces beside it stay fixed —
  // collapsing a bracket's half em on top of a boundary stage 1 has already tightened would take the
  // same word boundary away twice.
  { left: "any", right: ["cl-26"], spacing: SOLID },
  { left: PUNCTUATION_TAKING_SPACE_AFTER, right: ["cl-26"], spacing: FIXED_HALF },
  { left: ["cl-05"], right: ["cl-26"], spacing: FIXED_QUARTER },
  { left: ["cl-26"], right: "any", spacing: SOLID },
  { left: ["cl-26"], right: ["cl-01"], spacing: FIXED_HALF },
  { left: ["cl-26"], right: ["cl-05"], spacing: FIXED_QUARTER },

  { left: ["cl-08"], right: ["cl-08"], spacing: SOLID_EXPANDABLE },
];

const PAIR_SPACING_TABLE: ReadonlyMap<string, RuleSpacing> = new Map(
  PAIR_SPACING_RULES.flatMap(({ left, right, spacing }) =>
    (left === "any" ? boundaryClasses : left).flatMap((leftClass) =>
      (right === "any" ? boundaryClasses : right).map(
        (rightClass) => [`${leftClass}/${rightClass}`, spacing] as const,
      ),
    ),
  ),
);

function pairSpacing(left: JapaneseBoundaryClass, right: JapaneseBoundaryClass): RuleSpacing {
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
 * Binding sequences (JLReq C.2 note 5) depend on the actual characters and are resolved separately
 * by BoundaryRule.
 */
function breakPenalty(left: JapaneseBoundaryClass, right: JapaneseBoundaryClass): number | null {
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
  return 0;
}

export const defaultJapaneseTypesettingRules: JapaneseTypesettingRules = {
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
    // 欧文間隔 (cl-26) sets no box at all: the whole of its width is the アキ `spacingCharacter`
    // declares. The measured advance is discarded on purpose, the way 3.1.2's half em below
    // overrides the measurement for brackets and punctuation.
    if (characterClass === "cl-26") return { advanceEm: 0, renderOffsetEm: 0 };
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

  spacingCharacter: (characterClass, position) =>
    characterClass !== "cl-26" ? null : position === "mid-line" ? WORD_SPACE : EDGE_WORD_SPACE,

  /**
   * The half em trailing a closing bracket, full stop or comma at the line end, and the quarter em
   * trailing a middle dot there (JLReq 3.1.9). The book style selects their order and visual cost.
   *
   * Both are all-or-nothing. 3.1.9 admits the full アキ or ベタ組 and forbids anything in between, so a
   * line whose overflow is smaller than the アキ has to find the difference somewhere else — or break
   * elsewhere. A line-end middle dot takes the quarter before it into the same amount (表3 注5).
   */
  lineEndSpacing: (last) =>
    last === "cl-02" || last === "cl-06" || last === "cl-07"
      ? {
          spacing: {
            kind: "glue",
            naturalWidthEm: 0.5,
            shrink: {
              category: "line-end",
              amountEm: 0.5,
              granularity: "all-or-nothing",
            },
          },
          absorbsPrecedingEm: 0,
        }
      : last === "cl-05"
        ? {
            spacing: {
              kind: "glue",
              naturalWidthEm: 0.25,
              shrink: {
                category: "line-end",
                amountEm: 0.25,
                granularity: "all-or-nothing",
              },
            },
            absorbsPrecedingEm: 0.25,
          }
        : null,

  canExpandAtFinalStage,

  breakPenalty,

  /**
   * Hanging punctuation (ぶら下げ組, JLReq 3.8.2) lets a full stop or comma sit outside the text area
   * instead of forcing the line to be respaced. JLReq admits no other class for it.
   */
  canHang: (characterClass) => characterClass === "cl-07" || characterClass === "cl-06",
};
