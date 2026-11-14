import type { BookStyle } from "./book-style";
import { defaultBookStyle } from "./book-style";
import { defaultJapaneseTypesettingRules } from "./japanese-typesetting-rules";
import type {
  JapaneseCharacter,
  JapaneseCharacterClass,
  JapaneseBoundaryClass,
  JapaneseTypesettingRules,
  LineHeadKind,
  LinePosition,
  RuleSpacing,
  TypographicBoxMetrics,
} from "./japanese-typesetting-rules";
import type { CharacterSpacing, LineEndSpacing, PairSpacing } from "./spacing";

export type JapaneseTypesettingProfile = Readonly<{
  classify: (character: JapaneseCharacter) => JapaneseCharacterClass;
  boxMetrics: (
    characterClass: JapaneseCharacterClass,
    measuredAdvanceEm: number,
  ) => TypographicBoxMetrics;
  pairSpacing: (left: JapaneseBoundaryClass, right: JapaneseBoundaryClass) => PairSpacing;
  /**
   * 文字が組まれるボックスではなく、その文字自体が表すアキ。
   * グリフとして組むクラスでは `null` になる。JLReq がこう扱うクラスは欧文間隔（cl-26）だけだ。
   * 字面を持たず、幅は測定ではなく規則で決まり、行の調整処理はほかの何よりも先にその幅を変える。
   */
  spacingCharacter: (
    characterClass: JapaneseCharacterClass,
    position: LinePosition,
  ) => CharacterSpacing | null;
  lineStartSpacing: (first: JapaneseBoundaryClass, lineHead: LineHeadKind) => PairSpacing | null;
  lineEndSpacing: (last: JapaneseBoundaryClass) => LineEndSpacing | null;
  finalStretchCostPerEm: number;
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

export const JapaneseTypesettingProfile = {
  of: (rules: JapaneseTypesettingRules, style: BookStyle): JapaneseTypesettingProfile => {
    const resolved = new WeakMap<RuleSpacing, PairSpacing>();
    const spacing = (rule: RuleSpacing): PairSpacing => {
      const cached = resolved.get(rule);
      if (cached !== undefined) return cached;
      const result: PairSpacing = {
        kind: rule.kind,
        naturalWidthEm: rule.naturalWidthEm,
        ...(rule.shrink === undefined
          ? {}
          : {
              shrink: {
                amountEm: rule.shrink.amountEm,
                granularity: rule.shrink.granularity,
                ...style.adjustment("shrink", rule.shrink.category),
              },
            }),
        ...(rule.stretch === undefined
          ? {}
          : {
              stretch: {
                amountEm: rule.stretch.amountEm,
                granularity: rule.stretch.granularity,
                ...style.adjustment("stretch", rule.stretch.category),
              },
            }),
      };
      resolved.set(rule, result);
      return result;
    };
    return {
      classify: rules.classify,
      boxMetrics: rules.boxMetrics,
      pairSpacing: (left, right) => spacing(rules.pairSpacing(left, right)),
      spacingCharacter: (characterClass, position) => {
        const rule = rules.spacingCharacter(characterClass, position);
        return rule === null ? null : { ...spacing(rule), kind: "glue" };
      },
      lineStartSpacing: style.lineStartSpacing,
      lineEndSpacing: (last) => {
        const rule = rules.lineEndSpacing(last);
        return rule === null
          ? null
          : { spacing: spacing(rule.spacing), absorbsPrecedingEm: rule.absorbsPrecedingEm };
      },
      finalStretchCostPerEm: style.finalStretchCostPerEm,
      canExpandAtFinalStage: rules.canExpandAtFinalStage,
      breakPenalty: rules.breakPenalty,
      canHang: rules.canHang,
    };
  },
} as const;

export const defaultJapaneseTypesettingProfile = JapaneseTypesettingProfile.of(
  defaultJapaneseTypesettingRules,
  defaultBookStyle,
);
