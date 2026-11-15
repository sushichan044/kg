import type {
  ManuscriptDiagnostic,
  ManuscriptResult,
  NovelComposedManuscript,
} from "@sushichan044/kg-core";
import { connectWorker } from "kg-worker-rpc";

import type { ProofreadFailure } from "./manuscript";
import type { Api } from "./proofread.worker";

export type ProofreadOutcome = ManuscriptResult<readonly ManuscriptDiagnostic[], ProofreadFailure>;

/**
 * 後から別の要求が来て、結果が捨てられたことを示す
 */
export const SUPERSEDED = Symbol("superseded");

export type Proofreader = Disposable &
  Readonly<{
    proofread: (composed: NovelComposedManuscript) => Promise<ProofreadOutcome | typeof SUPERSEDED>;
  }>;

export function createProofreader(worker: Worker): Proofreader {
  const client = connectWorker<Api>(worker);
  let latest = 0;

  return {
    proofread: async (composed) => {
      const ticket = ++latest;
      const outcome = await client
        .proofread(composed)
        .catch((cause: unknown): ProofreadOutcome => ({
          ok: false,
          error: { kind: "WorkerFailed", cause },
        }));
      return ticket === latest ? outcome : SUPERSEDED;
    },
    [Symbol.dispose]: () => {
      client[Symbol.dispose]();
    },
  };
}
