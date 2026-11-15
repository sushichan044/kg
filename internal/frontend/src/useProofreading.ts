import type { ManuscriptDiagnostic, NovelComposedManuscript } from "@sushichan044/kg-core";
import { useEffect, useRef, useState } from "react";

import type { ProofreadFailure } from "./manuscript";
import { createProofreader, SUPERSEDED } from "./proofreader";
import type { Proofreader, ProofreadOutcome } from "./proofreader";

export type Proofreading =
  | Readonly<{ status: "pending"; previous: readonly ManuscriptDiagnostic[] }>
  | Readonly<{ status: "ready"; diagnostics: readonly ManuscriptDiagnostic[] }>
  | Readonly<{ status: "failed"; error: ProofreadFailure }>;

type Settled = Readonly<{
  composed: NovelComposedManuscript;
  outcome: ProofreadOutcome;
  lastReady: readonly ManuscriptDiagnostic[];
}>;

// 前回の校正診断は、新しい本文の範囲を超えるものを捨てる
// 残したものも位置がずれうるが、範囲外を指してクラッシュやハイライトの崩れを起こすことはない
function fitting(
  diagnostics: readonly ManuscriptDiagnostic[],
  { parsed }: NovelComposedManuscript,
): readonly ManuscriptDiagnostic[] {
  return diagnostics.filter(
    ({ range }) =>
      range.source.end <= parsed.source.length &&
      range.display.end <= parsed.displayText.length &&
      range.graphemes.end <= parsed.graphemes.length,
  );
}

// use() と Suspense だと、キー入力のたびにビューアーが suspend する
// そのため結果が届くまでは前回の校正診断を pending として返し、最後に組版した結果の校正だけを ready にする
export function useProofreading(composed: NovelComposedManuscript | null): Proofreading {
  const proofreaderRef = useRef<Proofreader | null>(null);
  const requestedRef = useRef<NovelComposedManuscript | null>(null);
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./proofread.worker.ts", import.meta.url), {
      type: "module",
    });
    // Worker の error イベントは要求に紐づかないので、直近の要求の失敗として扱う
    const onError = (event: ErrorEvent) => {
      const requested = requestedRef.current;
      if (requested === null) return;
      setSettled((previous) => ({
        composed: requested,
        outcome: { ok: false, error: { kind: "WorkerFailed", cause: event.message } },
        lastReady: previous?.lastReady ?? [],
      }));
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

    requestedRef.current = composed;
    const controller = new AbortController();
    void proofreader.proofread(composed).then((outcome) => {
      if (controller.signal.aborted || outcome === SUPERSEDED) return;
      setSettled((previous) => ({
        composed,
        outcome,
        lastReady: outcome.ok
          ? [...outcome.warnings, ...outcome.value]
          : (previous?.lastReady ?? []),
      }));
    });

    return () => {
      controller.abort();
    };
  }, [composed]);

  if (composed === null) return { status: "pending", previous: [] };
  if (settled?.composed !== composed) {
    return { status: "pending", previous: fitting(settled?.lastReady ?? [], composed) };
  }
  return settled.outcome.ok
    ? { status: "ready", diagnostics: settled.lastReady }
    : { status: "failed", error: settled.outcome.error };
}
