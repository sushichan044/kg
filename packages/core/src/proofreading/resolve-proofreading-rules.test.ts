import { describe, expect, test } from "vite-plus/test";

import { parseManuscript } from "../parser/parse-manuscript";
import { proofreadManuscript } from "./proofread-manuscript";
import { resolveProofreadingRules } from "./resolve-proofreading-rules";
import { allProofreadingRules, recommendedProofreadingRules } from "./rules/presets";

function parsed(source: string) {
  const result = parseManuscript(source);
  expect.assert(result.ok, "fixture did not parse");

  return result.value;
}

function ids(rules: ReturnType<typeof resolveProofreadingRules>) {
  expect.assert(rules.ok, "expected resolveProofreadingRules to succeed");

  return rules.value.map((rule) => rule.meta.id);
}

describe("resolveProofreadingRules", () => {
  test("runs no rules when the config is empty", () => {
    const resolved = resolveProofreadingRules({ rules: {} });

    expect.assert(resolved.ok, "expected resolveProofreadingRules to succeed");
    expect(resolved.value).toEqual([]);
  });

  test("skips a rule the config never mentions", () => {
    const resolved = resolveProofreadingRules({ rules: { "kg/dash": "error" } });

    expect(ids(resolved)).toEqual(["kg/dash"]);
  });

  test("off disables a rule that would otherwise report", () => {
    const resolved = resolveProofreadingRules({ rules: { "kg/paragraph-opening": "off" } });
    expect.assert(resolved.ok, "expected resolveProofreadingRules to succeed");

    const result = proofreadManuscript(parsed("本文"), { rules: resolved.value });
    expect.assert(result.ok, "expected proofreadManuscript to succeed");
    expect(result.value).toEqual([]);
  });

  test("warn produces a warning-severity report even for a rule with no severity of its own", () => {
    const resolved = resolveProofreadingRules({ rules: { "kg/paragraph-opening": "warn" } });
    expect.assert(resolved.ok, "expected resolveProofreadingRules to succeed");

    const result = proofreadManuscript(parsed("本文"), { rules: resolved.value });
    expect.assert(result.ok, "expected proofreadManuscript to succeed");
    expect(result.value).toMatchObject([{ severity: "warning" }]);
  });

  test("error forces an error-severity report even for a rule that reports warning on its own", () => {
    const resolved = resolveProofreadingRules({
      rules: { "kg/consistent-kanji-opening": "error" },
    });
    expect.assert(resolved.ok, "expected resolveProofreadingRules to succeed");

    const result = proofreadManuscript(parsed("　出来る\n　できる"), { rules: resolved.value });
    expect.assert(result.ok, "expected proofreadManuscript to succeed");
    expect(result.value).toMatchObject([{ severity: "error" }]);
  });

  test("a chosen level applies to every report the rule produces", () => {
    const resolved = resolveProofreadingRules({
      rules: { "kg/fullwidth-japanese-punctuation": "warn" },
    });
    expect.assert(resolved.ok, "expected resolveProofreadingRules to succeed");

    const result = proofreadManuscript(parsed("　こんにちは｡すごい!"), { rules: resolved.value });
    expect.assert(result.ok, "expected proofreadManuscript to succeed");
    expect(result.value.length).toBeGreaterThan(0);
    for (const diagnostic of result.value) {
      expect(diagnostic.severity).toBe("warning");
    }
  });

  test("rejects an unknown rule ID", () => {
    const resolved = resolveProofreadingRules({
      rules: { "kg/no-such-rule": "error" } as never,
    });

    expect.assert(resolved.ok === false, "expected resolveProofreadingRules to reject");
    expect(resolved.error).toEqual({ kind: "UnknownRuleId", ruleId: "kg/no-such-rule" });
  });

  test("rejects options for a rule that does not take any", () => {
    const resolved = resolveProofreadingRules({
      rules: { "kg/ellipsis-character": ["error", {}] as never },
    });

    expect.assert(resolved.ok === false, "expected resolveProofreadingRules to reject");
    expect(resolved.error).toEqual({
      kind: "UnexpectedRuleOptions",
      ruleId: "kg/ellipsis-character",
    });
  });

  test("rejects invalid options for a rule that takes them", () => {
    const resolved = resolveProofreadingRules({
      rules: { "kg/dash": ["error", { preferred: "ー" }] as never },
    });

    expect.assert(resolved.ok === false, "expected resolveProofreadingRules to reject");
    expect(resolved.error).toMatchObject({ kind: "InvalidRuleOptions", ruleId: "kg/dash" });
  });

  test("rejects a config that is not shaped like settings at all", () => {
    const resolved = resolveProofreadingRules({
      rules: { "kg/dash": 123 as never },
    });

    expect.assert(resolved.ok === false, "expected resolveProofreadingRules to reject");
    expect(resolved.error).toMatchObject({ kind: "InvalidConfig" });
  });

  test("spreading a preset and overriding one entry keeps the rest", () => {
    const resolved = resolveProofreadingRules({
      rules: { ...recommendedProofreadingRules, "kg/dash": "off" },
    });

    const ruleIds = ids(resolved);
    expect(ruleIds).not.toContain("kg/dash");
    expect(ruleIds).toContain("kg/paragraph-opening");
  });

  test("allProofreadingRules additionally includes the convention-dependent rules", () => {
    const resolved = resolveProofreadingRules({ rules: allProofreadingRules });

    const ruleIds = ids(resolved);
    expect(ruleIds).toContain("kg/consistent-kanji-opening");
    expect(ruleIds).toContain("kg/consistent-latin-width");
    expect(ruleIds).toContain("kg/consistent-numeral-width");
  });
});

describe("resolveProofreadingRules: rejected options carried over from individual rule factories", () => {
  test("rejects an empty openingBrackets set", () => {
    const resolved = resolveProofreadingRules({
      rules: { "kg/paragraph-opening": ["error", { openingBrackets: "" }] },
    });

    expect.assert(resolved.ok === false, "expected resolveProofreadingRules to reject");
    expect(resolved.error).toMatchObject({
      kind: "InvalidRuleOptions",
      ruleId: "kg/paragraph-opening",
    });
  });

  test("rejects a non-integer digit limit", () => {
    const resolved = resolveProofreadingRules({
      rules: { "kg/max-arabic-numeral-digits": ["error", { maxDigits: 0 }] },
    });

    expect.assert(resolved.ok === false, "expected resolveProofreadingRules to reject");
    expect(resolved.error).toMatchObject({
      kind: "InvalidRuleOptions",
      ruleId: "kg/max-arabic-numeral-digits",
    });
  });

  test("rejects an incomplete kanji/kana pair", () => {
    const resolved = resolveProofreadingRules({
      rules: {
        "kg/consistent-kanji-opening": ["warn", { pairs: [{ closed: "", opened: "こと" }] }],
      },
    });

    expect.assert(resolved.ok === false, "expected resolveProofreadingRules to reject");
    expect(resolved.error).toMatchObject({
      kind: "InvalidRuleOptions",
      ruleId: "kg/consistent-kanji-opening",
    });
  });

  test("rejects a pair whose two spellings are identical", () => {
    const resolved = resolveProofreadingRules({
      rules: {
        "kg/consistent-kanji-opening": ["warn", { pairs: [{ closed: "事", opened: "事" }] }],
      },
    });

    expect.assert(resolved.ok === false, "expected resolveProofreadingRules to reject");
    expect(resolved.error).toMatchObject({
      kind: "InvalidRuleOptions",
      ruleId: "kg/consistent-kanji-opening",
    });
  });
});
