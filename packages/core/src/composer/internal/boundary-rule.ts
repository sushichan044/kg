import type { JapaneseTypesettingProfile } from "./japanese-typesetting-profile";
import type { JapaneseBoundaryClass } from "./japanese-typesetting-rules";
import type { PairSpacing } from "./spacing";

type BreakConstraint =
  | Readonly<{ kind: "allowed"; penalty: number }>
  | Readonly<{
      kind: "prohibited";
      reason: "line-head" | "line-end" | "run-interior" | "ruby-interior" | "binding-sequence";
    }>;

export type BoundaryRule = Readonly<{
  break: BreakConstraint;
  spacing: PairSpacing | null;
  finalStretch: boolean;
}>;

type BoundaryContext = Readonly<{
  runInterior: boolean;
  rubyInterior: boolean;
  rubySpacingInterior: boolean;
  sourceGap: boolean;
  bindingSequence: boolean;
}>;

function breakConstraint(
  left: JapaneseBoundaryClass,
  right: JapaneseBoundaryClass,
  profile: JapaneseTypesettingProfile,
  context: BoundaryContext,
): BreakConstraint {
  if (context.runInterior) return { kind: "prohibited", reason: "run-interior" };
  if (context.bindingSequence) return { kind: "prohibited", reason: "binding-sequence" };
  const penalty = profile.breakPenalty(left, right);
  if (penalty === null) {
    return {
      kind: "prohibited",
      reason: left === "cl-01" || left === "cl-12" ? "line-end" : "line-head",
    };
  }
  if (context.rubyInterior) return { kind: "prohibited", reason: "ruby-interior" };
  return { kind: "allowed", penalty };
}

export const BoundaryRule = {
  resolve: (
    left: JapaneseBoundaryClass,
    right: JapaneseBoundaryClass,
    profile: JapaneseTypesettingProfile,
    context: BoundaryContext,
  ): BoundaryRule => {
    // ランや、グループルビ・熟語ルビで共有するまとまりは、
    // 許される分割位置でまとまりが分かれる場合でも、内部の字間を自分で持つ。
    // 禁則だけでは字間を抑止しない。
    const spacingAllowed =
      !context.runInterior && !context.rubySpacingInterior && !context.sourceGap;
    return {
      break: breakConstraint(left, right, profile, context),
      spacing: !spacingAllowed
        ? null
        : context.bindingSequence
          ? { kind: "kern", naturalWidthEm: 0 }
          : profile.pairSpacing(left, right),
      finalStretch:
        spacingAllowed && !context.bindingSequence && profile.canExpandAtFinalStage(left, right),
    };
  },
} as const;
