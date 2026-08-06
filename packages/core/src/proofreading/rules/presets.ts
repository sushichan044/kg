import type { ParsedProofreadingRule } from "../proofreading-rule";
import type { ProofreadingRuleSettings } from "../proofreading-rule-settings";
import { resolveProofreadingRules } from "../resolve-proofreading-rules";

/**
 * The built-in rules whose answer does not depend on the work: how a paragraph opens and how far it
 * is indented, punctuation before a closing bracket, spacing after `！` and `？`, ellipsis and dash
 * forms and counts, repeated punctuation and interpuncts, a minus sign that no number follows,
 * halfwidth Japanese punctuation, Arabic numeral length, and Unicode variation sequences.
 *
 * A plain settings object rather than an `extends` mechanism: spreading it into a caller's own
 * `rules` and overriding individual entries is exactly what a config author needs, and TypeScript
 * checks the result without any dedicated merge logic.
 */
export const recommendedProofreadingRules: ProofreadingRuleSettings = {
  "kg/paragraph-opening": "error",
  "kg/punctuation-before-closing-quote": "error",
  "kg/space-after-question-or-exclamation": "error",
  "kg/even-ellipsis": "error",
  "kg/dash": "error",
  "kg/ellipsis-character": "error",
  "kg/no-consecutive-punctuation": "error",
  "kg/no-consecutive-interpunct": "error",
  "kg/minus-before-number": "error",
  "kg/max-arabic-numeral-digits": "error",
  "kg/fullwidth-japanese-punctuation": "error",
  "kg/halfwidth-punctuation-near-japanese": "warn",
  "kg/variant-character": "error",
};

/**
 * Every built-in rule, including the ones that depend on the work's own conventions — which width
 * numerals and Latin letters take, whether a word is written in kanji or kana. Those rules are
 * `warn`, not `error`, so opting in through this preset does not silently start failing a build.
 */
export const allProofreadingRules: ProofreadingRuleSettings = {
  ...recommendedProofreadingRules,
  "kg/consistent-kanji-opening": "warn",
  "kg/consistent-latin-width": "warn",
  "kg/consistent-numeral-width": "warn",
};

/**
 * The zero-config entry point: `recommendedProofreadingRules` resolved into rule instances. Failure
 * here would mean this literal preset itself is malformed, which is a bug in core rather than
 * something a caller can act on — the same reasoning `NamespacedId.of` uses for a literal ID.
 */
export function createRecommendedProofreadingRules(): readonly ParsedProofreadingRule[] {
  const resolved = resolveProofreadingRules({ rules: recommendedProofreadingRules });
  if (!resolved.ok) {
    throw new Error(`recommendedProofreadingRules failed to resolve: ${resolved.error.kind}`);
  }

  return resolved.value;
}
