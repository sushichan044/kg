import type { JapaneseTypesettingProfile } from "./japanese-typesetting-profile";
import type { JapaneseBoundaryClass } from "./japanese-typesetting-rules";
import type { PairSpacing } from "./spacing";

export type BreakConstraint =
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

export type BoundaryContext = Readonly<{
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
    // Runs and shared group/jukugo complexes own their interior spacing, even
    // when a legal break splits the complex. Kinsoku alone does not suppress spacing.
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
