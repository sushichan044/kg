import { describe, expect, test } from "vite-plus/test";

import { composeManuscript } from "./composer/compose-manuscript";
import { NovelCompositionSettings } from "./composer/composition-settings";
import { novelComposer } from "./composer/novel-composer";
import type { NovelComposedManuscript } from "./composer/novel-composer";
import { parseManuscript } from "./parser/parse-manuscript";
import { proofreadManuscript } from "./proofreading/proofread-manuscript";
import type { ParsedProofreadingRule } from "./proofreading/proofreading-rule";
import { createDefaultProofreadingRules } from "./proofreading/rules/default-rules";
import { createProofreadingClient, defineProofreadingWorker } from "./worker-proofread";
import type { ProofreadingClient, ProofreadingWorkerOptions } from "./worker-proofread";

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

const throwingRule = {
  kind: "parsed",
  meta: { id: "example/throws", messages: {} },
  check: () => {
    throw new Error("rule failed");
  },
} as const satisfies ParsedProofreadingRule;

const unclonableRule = {
  kind: "parsed",
  meta: { id: "example/unclonable", messages: {} },
  check: () => {
    // 関数は structured clone できない
    // oxlint-disable-next-line only-throw-error
    throw () => {};
  },
} as const satisfies ParsedProofreadingRule;

type Setup = Readonly<{
  open: (options?: ProofreadingWorkerOptions<NovelComposedManuscript>) => ProofreadingClient;
}>;

const withWorker = test.extend<Setup>({
  open: async ({}, use) => {
    const clients: ProofreadingClient[] = [];
    await use((options) => {
      const { port1, port2 } = new MessageChannel();
      defineProofreadingWorker(options, port1);
      const client = createProofreadingClient(port2);
      clients.push(client);
      return client;
    });
    for (const client of clients) client.terminate();
  },
});

describe("proofreading worker", () => {
  withWorker("returns the same outcome as proofreading in place", async ({ open }) => {
    // Arrange
    const manuscript = composed("　正常\n問題");
    const client = open();

    // Act
    const outcome = await client.proofread(manuscript);

    // Assert
    expect(outcome).toEqual(
      proofreadManuscript(manuscript, { rules: createDefaultProofreadingRules() }),
    );
    expect.assert(outcome.ok, "expected the proofreading to succeed");
    expect(outcome.value).toHaveLength(1);
  });

  withWorker("proofreads a parsed manuscript", async ({ open }) => {
    // Arrange
    const manuscript = parsed("　正常\n問題");
    const client = open();

    // Act
    const outcome = await client.proofread(manuscript);

    // Assert
    expect(outcome).toEqual(
      proofreadManuscript(manuscript, { rules: createDefaultProofreadingRules() }),
    );
  });

  withWorker("returns a typed error when a rule throws", async ({ open }) => {
    // Arrange
    const client = open({ rules: () => [throwingRule] });

    // Act
    const outcome = await client.proofread(composed("本文"));

    // Assert
    expect.assert(!outcome.ok, "expected the proofreading to fail");
    expect(outcome.error).toMatchObject({ kind: "RuleThrew", ruleId: "example/throws" });
  });

  withWorker("keeps a thrown value that cannot be cloned as text", async ({ open }) => {
    // Arrange
    const client = open({ rules: () => [unclonableRule] });

    // Act
    const outcome = await client.proofread(composed("本文"));

    // Assert
    expect.assert(!outcome.ok, "expected the proofreading to fail");
    expect.assert(outcome.error.kind === "RuleThrew", "expected RuleThrew");
    expect(typeof outcome.error.cause).toBe("string");
  });

  withWorker("rejects when the signal is already aborted", async ({ open }) => {
    // Arrange
    const client = open();
    const controller = new AbortController();
    controller.abort(new Error("stale"));

    // Act
    const outcome = client.proofread(composed("本文"), { signal: controller.signal });

    // Assert
    await expect(outcome).rejects.toThrow("stale");
  });

  withWorker("rejects pending calls when terminated", async ({ open }) => {
    // Arrange
    const client = open();
    const outcome = client.proofread(composed("本文"));

    // Act
    client.terminate();

    // Assert
    await expect(outcome).rejects.toThrow("terminated");
  });
});
