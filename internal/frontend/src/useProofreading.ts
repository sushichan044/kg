import type { ManuscriptDiagnostic, NovelComposedManuscript } from "@sushichan044/kg-core";
import { useEffect, useRef, useState } from "react";

import type { ProofreadFailure } from "./manuscript";
import { createProofreader, SUPERSEDED } from "./proofreader";
import type { Proofreader, ProofreadOutcome } from "./proofreader";

export type Proofreading =
  | Readonly<{ status: "pending" }>
  | Readonly<{ status: "ready"; diagnostics: readonly ManuscriptDiagnostic[] }>
  | Readonly<{ status: "failed"; error: ProofreadFailure }>;

const PENDING: Proofreading = { status: "pending" };

type Settled = Readonly<{ composed: NovelComposedManuscript; outcome: ProofreadOutcome }>;

// use() と Suspense だと、キー入力のたびにビューアーが suspend する
// そのため結果が届くまでは pending を返し、最後に組版した結果の校正だけを ready にする
export function useProofreading(composed: NovelComposedManuscript | null): Proofreading {
  const proofreaderRef = useRef<Proofreader | null>(null);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [workerError, setWorkerError] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./proofread.worker.ts", import.meta.url), {
      type: "module",
    });
    const onError = (event: ErrorEvent) => {
      setWorkerError(event.message);
    };
    worker.addEventListener("error", onError);
    const proofreader = createProofreader(worker);
    proofreaderRef.current = proofreader;

    return () => {
      proofreaderRef.current = null;
      worker.removeEventListener("error", onError);
      proofreader[Symbol.dispose]();
    };
  }, []);

  useEffect(() => {
    const proofreader = proofreaderRef.current;
    if (composed === null || proofreader === null) return;

    const controller = new AbortController();
    void proofreader.proofread(composed).then((outcome) => {
      if (controller.signal.aborted || outcome === SUPERSEDED) return;
      setSettled({ composed, outcome });
    });

    return () => {
      controller.abort();
    };
  }, [composed]);

  if (composed === null) return PENDING;
  if (workerError !== null) {
    return { status: "failed", error: { kind: "WorkerFailed", cause: workerError } };
  }
  if (settled?.composed !== composed) return PENDING;
  return settled.outcome.ok
    ? { status: "ready", diagnostics: [...settled.outcome.warnings, ...settled.outcome.value] }
    : { status: "failed", error: settled.outcome.error };
}
