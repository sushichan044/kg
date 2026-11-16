import { useEffect, useEffectEvent, useState, useSyncExternalStore } from "react";

import { createMainThreadEngine, createWorkerEngine } from "./manuscript-engine";
import type { ManuscriptWorkerSource } from "./manuscript-engine";
import type { ManuscriptInput } from "./manuscript-pipeline";
import { ManuscriptSession } from "./manuscript-session";
import type { ManuscriptSnapshot } from "./manuscript-session";

export type UseManuscriptOptions = ManuscriptInput &
  Readonly<{
    /**
     * 組版を行う Worker、または Worker を作る関数
     * 省略するとメインスレッドで組版する
     */
    worker?: ManuscriptWorkerSource;
  }>;

export type ManuscriptState = ManuscriptSnapshot & Readonly<{ retry: () => void }>;

/**
 * 原稿を parse から校正まで処理し、組版結果と診断を返す
 *
 * 結果を待つあいだは直前の結果を返し続け、中断しない
 * 入力が続けて変わったときは最新のものだけを処理する
 */
export function useManuscript({ source, notation, settings, worker }: UseManuscriptOptions) {
  const [session] = useState(() => new ManuscriptSession());
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const createEngine = useEffectEvent(() =>
    worker === undefined ? createMainThreadEngine() : createWorkerEngine(worker),
  );
  // 関数は毎回作り直されうるので、Worker を渡したときだけ同一性で区別する
  const workerKey = typeof worker === "function" ? "factory" : (worker ?? "main");

  useEffect(() => session.connect(createEngine()), [session, workerKey]);
  useEffect(() => {
    session.request({ source, notation, settings });
  }, [session, source, notation, settings]);

  return { ...snapshot, retry: session.retry.bind(session) } satisfies ManuscriptState;
}
