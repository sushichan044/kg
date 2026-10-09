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

export { japaneseCharacterClasses } from "./japanese-typesetting-rules";
export type { JapaneseCharacterClass } from "./japanese-typesetting-rules";
export type { PairSpacing } from "./spacing";

export type JapaneseTypesettingProfile = Readonly<{
  classify: (character: JapaneseCharacter) => JapaneseCharacterClass;
  boxMetrics: (
    characterClass: JapaneseCharacterClass,
    measuredAdvanceEm: number,
  ) => TypographicBoxMetrics;
  pairSpacing: (left: JapaneseBoundaryClass, right: JapaneseBoundaryClass) => PairSpacing;
  /**
   * The アキ a character _is_, rather than the box it sets in, or `null` for every class that sets as
   * a glyph. 欧文間隔 (cl-26) is the only class JLReq treats this way: it carries no ink, its width is
   * stated by rule rather than measured, and the line adjustment resizes it before anything else.
   */
  spacingCharacter: (
    characterClass: JapaneseCharacterClass,
    position: LinePosition,
  ) => CharacterSpacing | null;
  lineStartSpacing: (first: JapaneseBoundaryClass, lineHead: LineHeadKind) => PairSpacing | null;
  lineEndSpacing: (last: JapaneseBoundaryClass) => LineEndSpacing | null;
  finalStretchCostPerEm: number;
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
