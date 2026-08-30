import { describe, expect, test } from "vite-plus/test";

import { composeManuscript } from "../composer/compose-manuscript";
import { NovelCompositionSettings } from "../composer/composition-settings";
import { novelComposer } from "../composer/novel-composer";
import type { NovelComposedManuscript } from "../composer/novel-composer";
import { parseManuscript } from "../parser/parse-manuscript";
import { proofreadManuscript } from "./proofread-manuscript";
import type { ComposedProofreadingRule, ParsedProofreadingRule } from "./proofreading-rule";
import { createDefaultProofreadingRules } from "./rules/default-rules";
import { createMaxArabicNumeralDigitsRule } from "./rules/max-arabic-numeral-digits";

function parsed(source: string) {
  const result = parseManuscript(source);
  expect.assert(result.ok, "fixture did not parse");

  return result.value;
}

function composed(source: string): NovelComposedManuscript {
  const result = composeManuscript(parsed(source), {
    composer: novelComposer,
    settings: NovelCompositionSettings.defaults,
  });
  expect.assert(result.ok, "fixture did not compose");

  return result.value;
}

const noopRule = {
  kind: "parsed",
  meta: { id: "example/noop", messages: {} },
  check: () => {},
} as const satisfies ParsedProofreadingRule;

describe("proofreadManuscript", () => {
  test("runs the built-in rules and derives raw locations across CRLF", () => {
    const result = proofreadManuscript(parsed("　正常\r\n問題"), {
      rules: createDefaultProofreadingRules(),
    });

    expect.assert(result.ok, "expected proofreadManuscript to succeed");
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({
      origin: { kind: "rule", id: "kg/paragraph-opening" },
      severity: "error",
      range: { source: { start: 5, end: 6 } },
      location: { start: { offset: 5, line: 2, column: 1 } },
    });
  });

  test("lets a custom rule report by message ID and range", () => {
    const rule = {
      kind: "parsed",
      meta: {
        id: "example/first-character",
        messages: { first: "先頭は {{ value }} です" },
      },
      check: (manuscript, context) => {
        const firstGrapheme = manuscript.graphemes[0];
        expect.assert(firstGrapheme !== undefined, "manuscript has no first grapheme");

        context.report({
          range: firstGrapheme.range,
          messageId: "first",
          data: { value: firstGrapheme.value },
        });
      },
    } as const satisfies ParsedProofreadingRule;

    expect(proofreadManuscript(parsed("本文"), { rules: [rule] })).toMatchObject({
      ok: true,
      value: [{ message: "先頭は 本 です", origin: { id: "example/first-character" } }],
    });
  });

  test("carries the severity a report names instead of defaulting to error", () => {
    const rule = {
      kind: "parsed",
      meta: { id: "example/confirmation", messages: { confirm: "確認してください" } },
      check: (manuscript, context) => {
        const firstGrapheme = manuscript.graphemes[0];
        expect.assert(firstGrapheme !== undefined, "manuscript has no first grapheme");

        context.report({
          range: firstGrapheme.range,
          messageId: "confirm",
          severity: "warning",
        });
      },
    } as const satisfies ParsedProofreadingRule;

    expect(proofreadManuscript(parsed("本文"), { rules: [rule] })).toMatchObject({
      ok: true,
      value: [{ severity: "warning" }],
    });
  });

  test("names the offending ID when two rules share one", () => {
    expect(proofreadManuscript(parsed("本文"), { rules: [noopRule, noopRule] })).toEqual({
      ok: false,
      error: { kind: "DuplicateRuleId", ruleId: "example/noop" },
    });
  });

  test("names the offending ID when a rule is not namespaced", () => {
    const rule = {
      kind: "parsed",
      meta: { id: "unnamespaced", messages: {} },
      check: () => {},
    } as const satisfies ParsedProofreadingRule;

    expect(proofreadManuscript(parsed("本文"), { rules: [rule] })).toEqual({
      ok: false,
      error: { kind: "InvalidRuleId", ruleId: "unnamespaced" },
    });
  });

  test("rejects a report that does not match the public report schema", () => {
    const rule = {
      kind: "parsed",
      meta: { id: "example/broken-report", messages: { broken: "broken" } },
      check: (_manuscript, context) => {
        // A JavaScript rule can report anything; the report schema is what stops it.
        context.report({ range: null, messageId: "broken" } as unknown as never);
      },
    } as const satisfies ParsedProofreadingRule;

    const result = proofreadManuscript(parsed("本文"), { rules: [rule] });

    expect.assert(result.ok === false, "expected proofreadManuscript to report a failure");
    expect(result.error).toMatchObject({
      kind: "InvalidReport",
      ruleId: "example/broken-report",
    });
  });

  test("names the message ID when a rule reports one it never declared", () => {
    const rule = {
      kind: "parsed",
      meta: { id: "example/undeclared", messages: {} },
      check: (manuscript, context) => {
        const firstGrapheme = manuscript.graphemes[0];
        expect.assert(firstGrapheme !== undefined, "manuscript has no first grapheme");

        context.report({ range: firstGrapheme.range, messageId: "missing" });
      },
    } as const satisfies ParsedProofreadingRule;

    expect(proofreadManuscript(parsed("本文"), { rules: [rule] })).toEqual({
      ok: false,
      error: {
        kind: "UnknownMessageId",
        ruleId: "example/undeclared",
        messageId: "missing",
      },
    });
  });

  test("turns a throwing rule into a typed error instead of propagating the throw", () => {
    const failure = new Error("boom");
    const rule = {
      kind: "parsed",
      meta: { id: "example/throws", messages: {} },
      check: () => {
        throw failure;
      },
    } as const satisfies ParsedProofreadingRule;

    expect(proofreadManuscript(parsed("本文"), { rules: [rule] })).toEqual({
      ok: false,
      error: { kind: "RuleThrew", ruleId: "example/throws", cause: failure },
    });
  });

  test("runs parsed and composed rules from a composed manuscript", () => {
    const seen: string[] = [];
    const parsedRule = {
      kind: "parsed",
      meta: { id: "example/parsed", messages: {} },
      check: () => {
        seen.push("parsed");
      },
    } as const satisfies ParsedProofreadingRule;
    const composedRule = {
      kind: "composed",
      meta: { id: "example/composed", messages: {} },
      check: (manuscript) => {
        seen.push(`composed:${manuscript.layout.stats.pages}`);
      },
    } as const satisfies ComposedProofreadingRule<NovelComposedManuscript>;

    const result = proofreadManuscript(composed("本文"), { rules: [parsedRule, composedRule] });

    expect(result.ok).toBe(true);
    expect(seen).toEqual(["parsed", "composed:1"]);
  });
});

describe("createMaxArabicNumeralDigitsRule", () => {
  test("reports the offending option when given a non-integer digit limit", () => {
    const result = createMaxArabicNumeralDigitsRule({ maxDigits: 0 });

    expect.assert(result.ok === false, "expected createMaxArabicNumeralDigitsRule to reject");
    expect(result.error).toMatchObject({
      kind: "InvalidRuleOptions",
      ruleId: "kg/max-arabic-numeral-digits",
      option: "maxDigits",
    });
  });

  test("honours a configured digit limit", () => {
    const rule = createMaxArabicNumeralDigitsRule({ maxDigits: 4 });
    expect.assert(rule.ok, "fixture did not build");

    const result = proofreadManuscript(parsed("　12345と123"), { rules: [rule.value] });

    expect.assert(result.ok, "expected proofreadManuscript to succeed");
    expect(result.value).toHaveLength(1);

    const firstDiagnostic = result.value[0];
    expect.assert(firstDiagnostic !== undefined, "expected at least one diagnostic");
    expect(firstDiagnostic.range.display).toEqual({ start: 1, end: 6 });
  });
});
