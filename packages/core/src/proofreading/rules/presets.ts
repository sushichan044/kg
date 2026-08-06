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
  "kg/paragraph-opening": "on",
  "kg/punctuation-before-closing-quote": "on",
  "kg/space-after-question-or-exclamation": "on",
  "kg/even-ellipsis": "on",
  "kg/dash": "on",
  "kg/ellipsis-character": "on",
  "kg/no-consecutive-punctuation": "on",
  "kg/no-consecutive-interpunct": "on",
  "kg/minus-before-number": "on",
  "kg/max-arabic-numeral-digits": "on",
  "kg/fullwidth-japanese-punctuation": "on",
  "kg/halfwidth-punctuation-near-japanese": "on",
  "kg/variant-character": "on",
};

/**
 * Every built-in rule, including the ones that depend on the work's own conventions — which width
 * numerals and Latin letters take, whether a word is written in kanji or kana. Those rules report
 * `warning` by default, so opting in through this preset does not silently start failing a build.
 */
export const allProofreadingRules: ProofreadingRuleSettings = {
  ...recommendedProofreadingRules,
  "kg/consistent-kanji-opening": "on",
  "kg/consistent-latin-width": "on",
  "kg/consistent-numeral-width": "on",
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
