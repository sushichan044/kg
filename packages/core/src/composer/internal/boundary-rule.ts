import type { JapaneseTypesettingProfile } from "./japanese-typesetting-profile";
import type { JapaneseCharacterClass } from "./japanese-typesetting-rules";
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
  sourceGap: boolean;
}>;

function breakConstraint(
  left: JapaneseCharacterClass,
  right: JapaneseCharacterClass,
  profile: JapaneseTypesettingProfile,
  context: BoundaryContext,
): BreakConstraint {
  if (context.runInterior) return { kind: "prohibited", reason: "run-interior" };
  const penalty = profile.breakPenalty(left, right);
  if (penalty === null) {
    return {
      kind: "prohibited",
      reason:
        left === "cl-01" || left === "cl-12"
          ? "line-end"
          : left === "cl-08" && right === "cl-08"
            ? "binding-sequence"
            : "line-head",
    };
  }
  if (context.rubyInterior) return { kind: "prohibited", reason: "ruby-interior" };
  return { kind: "allowed", penalty };
}

export const BoundaryRule = {
  resolve: (
    left: JapaneseCharacterClass,
    right: JapaneseCharacterClass,
    profile: JapaneseTypesettingProfile,
    context: BoundaryContext,
  ): BoundaryRule => {
    // The current style suppresses spacing inside runs and fittable group ruby. A kinsoku
    // prohibition alone does not suppress spacing or expansion.
    const spacingAllowed = !context.runInterior && !context.rubyInterior && !context.sourceGap;
    return {
      break: breakConstraint(left, right, profile, context),
      spacing: spacingAllowed ? profile.pairSpacing(left, right) : null,
      finalStretch: spacingAllowed && profile.canExpandAtFinalStage(left, right),
    };
  },
} as const;
