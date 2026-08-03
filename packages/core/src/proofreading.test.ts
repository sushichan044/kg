import { describe, expect, test } from "vite-plus/test";

import { parseManuscript } from "./notation";
import {
  DEFAULT_COMPOSITION_SETTINGS,
  composeManuscript,
  manuscriptGridComposer,
} from "./pagination";
import { createDefaultProofreadingRules, proofreadManuscript } from "./proofreading";
import type { ParsedProofreadingRule } from "./proofreading";

function fixture(source: string) {
  const parsed = parseManuscript(source);
  const rules = createDefaultProofreadingRules();
  if (!parsed.ok || !rules.ok) throw new Error("fixture setup failed");
  return { parsed: parsed.value, rules: rules.value };
}

describe("proofreadManuscript", () => {
  test("runs the built-in rules and derives raw locations across CRLF", () => {
    const { parsed, rules } = fixture("　正常\r\n問題");
    const result = proofreadManuscript(parsed, { rules });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({
      origin: { kind: "rule", id: "kg/paragraph-leading-character" },
      severity: "error",
      range: { source: { start: 5, end: 6 } },
      location: { start: { offset: 5, line: 2, column: 1 } },
    });
  });

  test("lets a custom rule report by message ID and range", () => {
    const { parsed } = fixture("本文");
    const rule: ParsedProofreadingRule = {
      meta: {
        id: "example/first-character",
        requires: "parsed",
        messages: { first: "先頭は {{ value }} です" },
      },
      check: (manuscript, context) => {
        context.report({
          range: manuscript.graphemes[0]!.range,
          messageId: "first",
          data: { value: manuscript.graphemes[0]!.value },
        });
      },
    };
    const result = proofreadManuscript(parsed, { rules: [rule] });

    expect(result).toMatchObject({
      ok: true,
      value: [{ message: "先頭は 本 です", origin: { id: "example/first-character" } }],
    });
  });

  test("rejects duplicate rule IDs", () => {
    const { parsed } = fixture("本文");
    const rule: ParsedProofreadingRule = {
      meta: { id: "example/duplicate", requires: "parsed", messages: {} },
      check: () => {},
    };

    expect(proofreadManuscript(parsed, { rules: [rule, rule] })).toMatchObject({
      ok: false,
      errors: [{ code: "duplicate-rule", stage: "proofread" }],
    });
  });

  test("rejects a report that does not match the public report schema", () => {
    const { parsed } = fixture("本文");
    const rule: ParsedProofreadingRule = {
      meta: { id: "example/broken-report", requires: "parsed", messages: { broken: "broken" } },
      check: (_manuscript, context) => {
        context.report({ range: null as never, messageId: "broken" });
      },
    };

    expect(proofreadManuscript(parsed, { rules: [rule] })).toMatchObject({
      ok: false,
      errors: [{ code: "invalid-report", stage: "proofread" }],
    });
  });

  test("runs parsed and composed rules from a composed manuscript", () => {
    const { parsed } = fixture("本文");
    const composed = composeManuscript(parsed, {
      composer: manuscriptGridComposer,
      settings: DEFAULT_COMPOSITION_SETTINGS,
    });
    if (!composed.ok) throw new Error("fixture did not compose");
    const seen: string[] = [];
    const parsedRule: ParsedProofreadingRule = {
      meta: { id: "example/parsed", requires: "parsed", messages: {} },
      check: () => seen.push("parsed"),
    };
    const result = proofreadManuscript(composed.value, {
      rules: [
        parsedRule,
        {
          meta: { id: "example/composed", requires: "composed", messages: {} },
          check: () => seen.push("composed"),
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(seen).toEqual(["parsed", "composed"]);
  });
});
