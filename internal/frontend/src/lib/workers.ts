import type { NovelComposedManuscript } from "@sushichan044/kg-core";
import { createProofreadingClient } from "@sushichan044/kg-core/worker/proofread";
import type { ProofreadingClient } from "@sushichan044/kg-core/worker/proofread";

let proofreading: ProofreadingClient<NovelComposedManuscript> | undefined;

/**
 * 校正の Worker はアプリ全体で 1 つを共有し、最初に使うときに作る。
 */
export function getProofreadingClient(): ProofreadingClient<NovelComposedManuscript> {
  proofreading ??= createProofreadingClient<NovelComposedManuscript>(
    new Worker(new URL("../proofread.worker.ts", import.meta.url), { type: "module" }),
  );
  return proofreading;
}

/**
 * 書き出しの Worker は、書き出しのたびに作って止める。
 */
export function createExportWorker(): Worker {
  return new Worker(new URL("../export.worker.ts", import.meta.url), { type: "module" });
}
