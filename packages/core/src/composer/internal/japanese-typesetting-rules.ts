import { assertNever } from "../../internal/assert-never";
import { CLOSING_BRACKETS, OPENING_BRACKETS } from "../../internal/japanese-brackets";
import { SENTENCE_ENDING_MARKS, TATE_CHU_YOKO_MARKS } from "../../internal/japanese-punctuation";
import type { PresentationKind } from "../presentation-kind";

/**
 * このルールが区別する JLReq の文字クラス。
 * 説明的な名前ではなく `cl-NN` の識別子をそのまま使うのは、
 * 下の字間とペナルティの表を規格の表と並べて読めるようにするためだ。
 *
 * JLReq は30の文字クラスを定める。数式（cl-17、cl-18）と割注括弧類（cl-28、cl-29）は、
 * 小説では使わないので含めない。親文字群のクラスを含めないのは別の理由による。
 * 小説にもルビ（cl-22、cl-23）はあるが、ルビはコンポーザーが別に配置する注釈であり、
 * `JapaneseCharacter` はそもそも親文字群を表せない。
 * 合印（cl-20）や添え字付きの親文字（cl-21）も同様だ。
 * そのため、親文字はここでは単独の場合のクラスに分類する。
 * ルビが付くことの多い漢字なら cl-19 になる。
 *
 * @see https://www.w3.org/TR/jlreq/#character_classes
 */
/**
 * @internal
 */
export const japaneseCharacterClasses = [
  // 始め括弧類
  "cl-01",
  // 終わり括弧類
  "cl-02",
  // ハイフン類
  "cl-03",
  // 区切り約物（疑問符と感嘆符）
  "cl-04",
  // 中点類
  "cl-05",
  // 句点類
  "cl-06",
  // 読点類
  "cl-07",
  // 分離禁止文字（同じ文字が連続するとき、その間で分割してはならない文字）
  "cl-08",
  // 繰返し記号
  "cl-09",
  // 長音記号
  "cl-10",
  // 小書きの仮名
  "cl-11",
  // 前置省略記号（通貨記号など）
  "cl-12",
  // 後置省略記号（度記号やパーセント記号など）
  "cl-13",
  // 和字間隔（全角スペース）
  "cl-14",
  // 平仮名
  "cl-15",
  // 片仮名
  "cl-16",
  // 漢字等。どのクラスにも当たらない文字の分類先も兼ねる。
  "cl-19",
  // 連数字中の文字
  "cl-24",
  // 単位記号中の文字
  "cl-25",
  // 欧文間隔
  "cl-26",
  // 欧文用文字
  "cl-27",
  // 縦中横中の文字
  "cl-30",
] as const;

export type JapaneseCharacterClass = (typeof japaneseCharacterClasses)[number];

export type JapaneseBoundaryClass = JapaneseCharacterClass | "cl-22" | "cl-23";
const boundaryClasses = [...japaneseCharacterClasses, "cl-22", "cl-23"] as const;

/**
 * 文字と、その文字にすでに選んだ縦組での表示方法の組。
 * 同じ文字でも、縦中横の中では単独の場合と異なるクラスに分類されるからだ。
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

type RuleSpacingCapacity = Readonly<{
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

type RuleCharacterSpacing = RuleSpacing & Readonly<{ kind: "glue" }>;
export type LineHeadKind = "paragraph-start" | "turned-over";
export type LinePosition = "line-edge" | "mid-line";
type RuleLineEndSpacing = Readonly<{
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
   * 文字が組まれるボックスではなく、その文字自体が表すアキ。
   * グリフとして組むクラスでは `null` になる。JLReq がこう扱うクラスは欧文間隔（cl-26）だけだ。
   * 字面を持たず、幅は測定ではなく規則で決まり、行の調整処理はほかの何よりも先にその幅を変える。
   */
  spacingCharacter: (
    characterClass: JapaneseCharacterClass,
    position: LinePosition,
  ) => RuleCharacterSpacing | null;
  lineEndSpacing: (last: JapaneseBoundaryClass) => RuleLineEndSpacing | null;
  /**
   * その組合せが JLReq 3.8.4 の最終段階の空ける処理に加わるかどうか。
   * これは行の分割の可否とは独立している。
   * 表6 は、禁則では分割位置として認めない行中の字間の一部も、空ける処理の対象にしている。
   */
  canExpandAtFinalStage: (left: JapaneseBoundaryClass, right: JapaneseBoundaryClass) => boolean;
  /**
   * 二つのクラスの間での分割が禁止される場合は `null`、そうでなければ呼び出し側が考慮できるコスト。
   * 現在のコンポーザーは `null` かどうかしか見ないので、許される分割はすべてコスト0とする。
   */
  breakPenalty: (left: JapaneseBoundaryClass, right: JapaneseBoundaryClass) => number | null;
  canHang: (characterClass: JapaneseBoundaryClass) => boolean;
}>;

const OPENING = new Set(`${OPENING_BRACKETS}【〘〝｟«`);
const CLOSING = new Set(`${CLOSING_BRACKETS}】〙〟｠»`);
const HYPHENS = new Set("‐‑⁃–");
const DIVIDING_MARKS = new Set(SENTENCE_ENDING_MARKS);
const COMBINED_DIVIDING_MARKS = new Set(TATE_CHU_YOKO_MARKS);
const MIDDLE_DOTS = new Set("・：；");
const SMALL_KANA = new Set(
  "ァィゥェォッャュョヮヵヶㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿぁぃぅぇぉっゃゅょゎゕゖ",
);
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
 * 順序に意味がある。縦中横中の文字は cl-30（3.2.5）、
 * 正立の欧字やアラビア数字は cl-19（3.2.4）になり、単独の場合のクラスは問わない。
 * どれにも当たらない文字も、JLReq が漢字等に充てる cl-19 になる。縦中横の `！？` は、
 * JLReq が `⁉` に与えるクラスである cl-04 のままなので、引き続き行頭に置けない。
 *
 * 3.2.6 が和文と欧字または数字の間に入れる四分は、縦組で90度回転した文字か、
 * 横組に混ぜた文字にだけ適用する。3.2.6 はこの範囲を明示している。
 * 正立で組む文字には独自の規則 3.2.4 があり、
 * 全角のモノスペースのグリフとして漢字と同じクラスに分類し、隣とはベタ組にする。
 * 縦中横のランに対する 3.2.5 と同じだ。
 */
function classify({ value, presentation }: JapaneseCharacter): JapaneseCharacterClass {
  value = value.replace(/[\u3099\u309A]/gu, "");
  switch (presentation) {
    case "tate-chu-yoko": {
      return COMBINED_DIVIDING_MARKS.has(value) ? "cl-04" : "cl-30";
    }

    case "upright": {
      return "cl-19";
    }

    case "sideways":
    case "mixed": {
      if (presentation === "sideways" && /^[!-~]$/u.test(value) && !/^[A-Za-z0-9]$/u.test(value))
        return "cl-27";

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
    default: {
      return assertNever(presentation);
    }
  }
}

/**
 * 表1 で無印、表6 で色なし。この組合せはベタ組で、行の調整処理でも変えない。
 */
const SOLID: RuleSpacing = { kind: "glue", naturalWidthEm: 0 };
/**
 * 表6 の `1/4`。ベタ組だが、行の調整処理で四分まで空けてよい。
 */
const SOLID_EXPANDABLE: RuleSpacing = {
  kind: "glue",
  naturalWidthEm: 0,
  stretch: { category: "solid", amountEm: 0.25, granularity: "continuous" },
};
/**
 * 表1 の `1/2` と表3 の `1/2-0`。行の調整処理でベタ組まで詰めてよい二分。
 */
const HALF: RuleSpacing = {
  kind: "glue",
  naturalWidthEm: 0.5,
  shrink: { category: "punctuation", amountEm: 0.5, granularity: "continuous" },
};
/**
 * 両方の表で `1/2`。二分のアキはあるが、詰める処理が可能な箇所ではない。
 */
const FIXED_HALF: RuleSpacing = { kind: "glue", naturalWidthEm: 0.5 };
/**
 * 表1 の `1/4` と表3 の `1/4-0`。ベタ組まで詰めてよい四分。
 */
const QUARTER: RuleSpacing = {
  kind: "glue",
  naturalWidthEm: 0.25,
  shrink: { category: "middle-dot", amountEm: 0.25, granularity: "continuous" },
};
/**
 * 両方の表で `1/4`。四分のアキはあるが、詰める処理が可能な箇所ではない。
 */
const FIXED_QUARTER: RuleSpacing = { kind: "glue", naturalWidthEm: 0.25 };
/**
 * 表3 の `1/4-1/8` と表6 の `1/4-1/2`。和欧間の四分で、
 * 八分まで詰めることも二分まで空けることもできる。3.2.6 がこれを入れるのは、
 * 90度回転した欧字または横組に混ぜた欧字（cl-27）と、
 * 数字または単位記号（cl-24、cl-25）に対してだけだ。正立の欧字は代わりに cl-19 に分類され、
 * この定数には至らない。
 */
const MIXED_TEXT_QUARTER: RuleSpacing = {
  kind: "glue",
  naturalWidthEm: 0.25,
  shrink: { category: "mixed-text", amountEm: 0.125, granularity: "continuous" },
  stretch: { category: "mixed-text", amountEm: 0.25, granularity: "continuous" },
};
/**
 * 同じ四分のうち、表6 が空ける処理の対象から外すもの。単位記号と、その前後の数量との間に入る。
 */
const UNIT_SYMBOL_QUARTER: RuleSpacing = {
  kind: "glue",
  naturalWidthEm: 0.25,
  shrink: { category: "mixed-text", amountEm: 0.125, granularity: "continuous" },
};
/**
 * 表1 注3 と表3 注1。二つの中点が隣り合い、それぞれの四分を一緒にベタ組にする。
 */
const TWO_QUARTERS: RuleSpacing = {
  kind: "glue",
  naturalWidthEm: 0.5,
  shrink: { category: "middle-dot", amountEm: 0.5, granularity: "continuous" },
};
/**
 * 表1 注5 と表3 注2。句点の固定の二分と、後ろに続く中点の四分。
 */
const FIXED_HALF_AND_QUARTER: RuleSpacing = {
  kind: "glue",
  naturalWidthEm: 0.75,
  shrink: { category: "middle-dot", amountEm: 0.25, granularity: "continuous" },
};
/**
 * 表1 注5 と表3 注3。読点の二分と、後ろに続く中点の四分。
 *
 * 表3 は四分を第4段階で、二分を第5段階で詰めるが、一つの調整可能量ではそれを表せない。
 * どちらもベタ組まで詰められるので合計は正しく、崩れるのは順序だけだ。`、・` はまれなので、
 * その順序の違いが表に出ることはない。
 */
const HALF_AND_QUARTER: RuleSpacing = {
  kind: "glue",
  naturalWidthEm: 0.75,
  shrink: { category: "punctuation", amountEm: 0.75, granularity: "continuous" },
};
/**
 * 欧文間隔（cl-26）の三分アキ。JLReq は欧文間隔を測定ではなく規則で全角の3分の1と定め、
 * 行の調整処理で最初に手をつけるアキとしている。行がはみ出すときは四分アキまで詰め（3.8.3 a）、
 * 足りないときは二分アキまで空ける（3.8.4 a）。
 *
 * 二つの調整可能量は `1/12` と `1/6` ではなく、限界からの差として書く。
 * 全角の3分の1は2進数で表せないが、JLReq が示す限界は表せるからだ。
 * こうすると `naturalWidthEm - shrink.amountEm` はちょうど 0.25、
 * `naturalWidthEm + stretch.amountEm` はちょうど 0.5 になる。
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
 * 表1 注13 と表3 注4。行頭や行末の欧文間隔は幅を持たず、調整箇所にもならない。
 * そのアキは版面の外に出て、読者からは見えないからだ。
 * 注13 は「ただし，この部分が移動し，これとは異なる配置になった場合は，欧文間隔（cl-26）の空き量を
 * 確保する」と付け加えている。そのため、この答えはソースの行ごとに1回ではなく、候補行ごとに出す。
 */
const EDGE_WORD_SPACE: RuleCharacterSpacing = { kind: "glue", naturalWidthEm: 0 };

/**
 * 数字、単位記号、または90度回転した欧字か横組に混ぜた欧字に対して四分を取るクラス（3.2.6）。
 * 正立の欧字は cl-19 に分類され、代わりに漢字等の一般の行と列で扱う。
 * 区切り約物がこのリストに入るのはこの向きだけだ。`？` や `！` の前はベタ組だからだ（3.1.6）。
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
 * 表6 の色付きの小間。第3段階でベタ組の組合せを空けてよいクラス。どちらのリストにも、括弧、中点、
 * 句点、読点、ハイフン、和字間隔、欧文間隔は含まない。JLReq はそれらをどれも空けないからだ。
 * また、数字、単位記号、欧字を含むのは左側のリストだけだ。
 * それらの和文側のアキは第2段階に属するからだ。
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
 * 表6 のグレー、青、ピンクの小間。空ける処理の第4段階、つまり最終段階に加わるすべての組合せ。
 * 上の有限の調整可能量は、青とピンクの小間を第3段階と第2段階で扱う。それらの段階を使い切ると、
 * JLReq 3.8.4 d がここに挙げたすべての小間に残りを均等に加える。
 *
 * Cl-08 同士の小間が青になるのは、種類の異なる記号の場合だけだ（注4）。
 * BoundaryRule は元の文字の値を使って、分割不可の文字の連続を除外する。
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
  // 明示的なアキは自分の幅を持ち、横向きの欧文のラン（cl-27）は
  // 独立した和文の文字ではなく一つの単語として読む。
  // そのどちらかの隣に上限のない境界をさらに加えると、
  // アキが二重になるか、ラン自体の長さに見合わない穴が空く。
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
  // ルビのまとまりは、通常の和文と同じ最終段階の小間を使う。所属による制約は、
  // これらの数値の調整可能量を使う前に BoundaryRule が解決する。
  const leftClass = left === "cl-22" || left === "cl-23" ? "cl-19" : left;
  const rightClass = right === "cl-22" || right === "cl-23" ? "cl-19" : right;
  if (FINAL_EXPANSION_AFTER.get(leftClass)?.has(rightClass) !== true) return false;

  // もともとアキを持つ組合せは、すでに約物や和欧混植としての意味を担っている。有限の段階があれば、
  // それが上限になる。最終段階を使うのは、調整前にベタ組の組合せだけだ。
  return pairSpacing(left, right).naturalWidthEm === 0;
}

/**
 * JLReq 3.1.2 が全角ではなく二分で組むクラス。
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
 * 附属書 表1（文字間の空き量）と表3（行の調整処理で詰める処理が可能な箇所）を、行・列と、
 * 表自体が持つ例外として表したもの。後のルールが前のルールを上書きするので、
 * 各ブロックは附属書と同じ順に読める。表の列、次に行、最後にその行の例外となる小間の順だ。
 *
 * 表1 の `be` と `af` は、二分や四分をどちらの文字サイズで測るかを示すだけだ。
 * コンポーザーが文字サイズを一つしか使わない間は違いが出ないので、ここでは記法を量に簡略化する。
 *
 * @see https://www.w3.org/TR/jlreq/#spacing_between_characters
 * @see https://www.w3.org/TR/jlreq/#opportunities_for_intercharacter_space_reduction_during_line_adjustment
 */
const PAIR_SPACING_RULES: readonly PairSpacingRule[] = [
  { left: "any", right: "any", spacing: SOLID },

  // 最初に表6（行の調整処理で空ける処理が可能な箇所）を置く。
  // 下のルールはどれも、組合せをベタ組のままにするか独自のアキで置き換えるかのどちらかで、
  // 表6 はもともとベタ組の組合せだけを空けるからだ。表6 が空ける和欧間の四分は、
  // 独自の調整可能量を持つ。
  { left: EXPANDABLE_BEFORE, right: EXPANDABLE_AFTER, spacing: SOLID_EXPANDABLE },
  // 表6 の cl-24 / cl-25 / cl-27 の列。和文でも欧文でもない記号も、それらに対して空けてよい。
  // 注10 により、欧字の後ろのパーセント記号や度記号も含む。
  { left: ["cl-08", "cl-12", "cl-13"], right: NUMERAL_UNIT_OR_WESTERN, spacing: SOLID_EXPANDABLE },
  // 表6 がこの二つのブロックの中で白のままにしている小間。
  // 前置省略記号は後ろに付く数字と結びつき（`￥100`）、
  // 注8 は数字を後置省略記号に密着させる（`10％`）。残りの二つについては、
  // 表は小間を空欄にしている以外の理由を示していない。
  { left: ["cl-08"], right: ["cl-24", "cl-25"], spacing: SOLID },
  { left: ["cl-12"], right: ["cl-24"], spacing: SOLID },
  { left: ["cl-24"], right: ["cl-13"], spacing: SOLID },
  { left: ["cl-09", "cl-10", "cl-11"], right: ["cl-08"], spacing: SOLID },

  // 表1 の cl-01 の列。始め括弧の前は二分アキ（3.1.2）。
  { left: "any", right: ["cl-01"], spacing: HALF },
  // 表1 の cl-05 の列。中点の前は四分アキ（3.1.2）。
  { left: "any", right: ["cl-05"], spacing: QUARTER },
  // 表1 の cl-02 / cl-06 / cl-07 の列。これらのアキは後ろに置き、前には置かない（3.1.4 ①②）。
  { left: "any", right: PUNCTUATION_TAKING_SPACE_AFTER, spacing: SOLID },

  // 和文と、数字、単位記号、欧字との間（3.2.6）。
  { left: JAPANESE_BEFORE_WESTERN, right: NUMERAL_UNIT_OR_WESTERN, spacing: MIXED_TEXT_QUARTER },
  { left: NUMERAL_UNIT_OR_WESTERN, right: JAPANESE_AFTER_WESTERN, spacing: MIXED_TEXT_QUARTER },
  // 表1 の cl-24 / cl-25 / cl-27 の交差。単位記号は隣の数量との間に四分を取る。
  // 3.1.10 は `4 km` の `4` と `k` の間についてこれを慣用としている（図2.28）。
  // 表6 はこれらを決して空けず、表3 は数字と単位の間の四分を行の調整処理の対象から完全に外す。
  { left: ["cl-25"], right: ["cl-24"], spacing: UNIT_SYMBOL_QUARTER },
  { left: ["cl-27"], right: ["cl-25"], spacing: UNIT_SYMBOL_QUARTER },
  { left: ["cl-24"], right: ["cl-25"], spacing: FIXED_QUARTER },

  // 表1 の cl-02 / cl-07 の行。終わり括弧と読点の後ろは二分アキ（3.1.2）。
  { left: ["cl-02", "cl-07"], right: "any", spacing: HALF },
  // 表1 の cl-06 の行。句点も同じだが、行中の句点の後ろの二分は文の終わりを示すので、
  // JLReq 3.8.3 は行の調整処理の対象から完全に外す。
  { left: ["cl-06"], right: "any", spacing: FIXED_HALF },
  // 表1 の cl-05 の列をもう一度適用する。そうしないと上の行のルールが上書きしてしまう（表1 注5）。
  { left: ["cl-02"], right: ["cl-05"], spacing: QUARTER },
  { left: ["cl-06"], right: ["cl-05"], spacing: FIXED_HALF_AND_QUARTER },
  { left: ["cl-07"], right: ["cl-05"], spacing: HALF_AND_QUARTER },
  // 連続する約物の間はベタ組にし、後ろの二分は1回だけ取る（3.1.4 ①②⑥）。
  {
    left: PUNCTUATION_TAKING_SPACE_AFTER,
    right: PUNCTUATION_TAKING_SPACE_AFTER,
    spacing: SOLID,
  },
  // 表1 の cl-02 の行と cl-14 の列。終わり括弧の後ろの和字間隔が二分を吸収する。
  { left: ["cl-02"], right: ["cl-14"], spacing: SOLID },

  // 表1 の cl-05 の行。中点は後ろにも四分を取る（3.1.2）。そのため中点は、
  // 二分のボックスの両側に四分ずつを持ち、全体で全角1字分を占める。
  { left: ["cl-05"], right: "any", spacing: QUARTER },
  { left: ["cl-05"], right: ["cl-05"], spacing: TWO_QUARTERS },

  // 表1 の cl-01 の行。始め括弧のアキは前に置くので、後ろには何も続かない（3.1.4 ⑤）。
  { left: ["cl-01"], right: "any", spacing: SOLID },
  { left: ["cl-01"], right: ["cl-05"], spacing: QUARTER },

  // 表1 の cl-14 の行。和字間隔はそれ自体がアキなので、後ろにアキは要らない。
  { left: ["cl-14"], right: "any", spacing: SOLID },
  { left: ["cl-14"], right: ["cl-05"], spacing: QUARTER },

  // 表1 の cl-26 の行と列。欧文間隔は隣とベタ組にする。ただし、始め括弧が常に取る二分と、
  // 中点が常に取る四分は除く。表3 はこの行と列のどの小間も詰める処理が可能な箇所としておらず、
  // その前文が理由を示している。調整の第1段階は欧文間隔自体の幅であり、
  // 表は「優先順位の第2段階以降の処理」だけを示すからだ。
  // そのため欧文間隔は `spacingCharacter` が狭め、その隣のアキは固定のままにする。
  // 第1段階ですでに詰めた境界で括弧の二分まで詰めると、同じ単語の区切りを二重に詰めることになる。
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
 * `null` は分割位置にコストを付けるのではなく、分割位置そのものをなくす。
 * 下の三つのルールは優先度ではなく禁止だからだ。
 *
 * 行末禁則（JLReq 3.1.8）。始め括弧と前置省略記号は、後ろに続くものに属するので、
 * 行の最後の文字にしてはならない。
 *
 * 行頭禁則（JLReq 3.1.7）。終わり括弧、ハイフン、区切り約物、中点、句点、読点、繰返し記号、
 * 長音記号、小書きの仮名、後置省略記号は、行頭に置いてはならない。
 *
 * 分割不可の文字の連続（JLReq C.2 注5）は実際の文字に依存するので、BoundaryRule が別に解決する。
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
   * 始め括弧、終わり括弧、句点、読点、中点は二分で組む（JLReq 3.1.2）。
   * 組合せの表がその周りに入れるアキによって、それぞれ全角1字分に戻る。
   *
   * 全角のグリフは、フォントが置いた位置に字面を描き続ける。そのため送り幅を半分にしただけでは、
   * 字面がボックスの外にはみ出す。オフセットで字面を引き戻し、始め括弧は全角の後ろ半分に、
   * 中点は中央に、それ以外は前半分に描く。
   */
  boxMetrics: (characterClass, measuredAdvanceEm) => {
    // 欧文間隔（cl-26）はボックスを一切持たない。幅全体が `spacingCharacter` の示すアキだ。
    // 測定した送り幅は意図して捨てる。下で 3.1.2 の二分が括弧類や約物の測定値を上書きするのと
    // 同じだ。
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
   * 行末の終わり括弧、句点、読点の後ろの二分と、行末の中点の後ろの四分（JLReq 3.1.9）。
   * その順序と見た目のコストは組版スタイルが決める。
   *
   * どちらも二択だ。3.1.9 はアキをすべて取るかベタ組にするかだけを認め、その中間を禁じる。
   * そのため、はみ出し量がそのアキより小さい行は、差分をほかで見つけるか、
   * ほかの位置で分割するしかない。行末の中点は、前の四分も同じ量に含める（表3 注5）。
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
   * ぶら下げ組（JLReq 3.8.2）では、行の字間を組み直す代わりに、句点や読点を版面の外に置く。
   * JLReq はほかのクラスにはこれを認めない。
   */
  canHang: (characterClass) => characterClass === "cl-07" || characterClass === "cl-06",
};
