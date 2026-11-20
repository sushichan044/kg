import { ManuscriptResult } from "@sushichan044/kg-core";
import { callWithAbort, closeWorker, connectWorker } from "kg-worker-rpc";
import type { WorkerClient } from "kg-worker-rpc";

import { createManuscriptPipeline } from "./manuscript-pipeline";
import type {
  ManuscriptInput,
  ManuscriptOutcome,
  ProofreadManuscriptInput,
  ProofreadManuscriptOutcome,
} from "./manuscript-pipeline";
import type { ManuscriptWorkerApi } from "./worker";

/**
 * 利用者が作った Worker か、作り直せるようにするためのその生成関数
 */
export type ManuscriptWorkerSource = Worker | (() => Worker);

export type ManuscriptEngine = Readonly<{
  process: (input: ManuscriptInput) => Promise<ManuscriptOutcome>;
  dispose: () => void;
}>;

// 利用者の Worker は、Comlink の proxy を解放すると Worker 側の待ち受けが外れて使い回せなくなる
// そのため解放せず、同じ Worker には同じクライアントを使う
const sharedClients = new WeakMap<Worker, WorkerClient<ManuscriptWorkerApi>>();
const deadWorkers = new WeakSet<Worker>();

function workerFailure(message: string) {
  return ManuscriptResult.fail({ stage: "worker", message } as const);
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function createMainThreadEngine(): ManuscriptEngine {
  const pipeline = createManuscriptPipeline();
  return { process: pipeline.process, dispose: pipeline.dispose };
}

type Connection = Readonly<{
  worker: Worker;
  client: WorkerClient<ManuscriptWorkerApi>;
  detach: () => void;
}>;

function connect(worker: Worker, owned: boolean): Connection {
  // クライアントが stop を検知した Worker は次の要求で再利用しない。
  const onError = () => deadWorkers.add(worker);
  worker.addEventListener("error", onError);
  worker.addEventListener("messageerror", onError);
  let client = sharedClients.get(worker);
  if (client === undefined) {
    client = connectWorker<ManuscriptWorkerApi>(worker);
    if (!owned) sharedClients.set(worker, client);
  }
  const shared = client;
  return {
    worker,
    client: shared,
    detach: () => {
      worker.removeEventListener("error", onError);
      worker.removeEventListener("messageerror", onError);
      if (owned) closeWorker(shared);
    },
  };
}

/**
 * Worker に要求を送るエンジン
 * 関数を渡されたときは Worker が死ぬたびに次の要求で作り直し、Worker を渡されたときは作り直せない
 */
export function createWorkerEngine(source: ManuscriptWorkerSource): ManuscriptEngine {
  const worker = createManuscriptWorkerClient(source);
  return { process: worker.process, dispose: worker.dispose };
}

type ManuscriptWorkerClient = ManuscriptEngine &
  Readonly<{
    proofread: (input: ProofreadManuscriptInput) => Promise<ProofreadManuscriptOutcome>;
  }>;

/**
 * Connect to a worker started by startManuscriptWorker.
 */
export function createManuscriptWorkerClient(
  source: ManuscriptWorkerSource,
): ManuscriptWorkerClient {
  let connection: Connection | null = null;
  let disposed = false;
  const signal = new AbortController().signal;

  const acquire = (): Connection | null => {
    if (connection !== null && !deadWorkers.has(connection.worker)) return connection;
    if (typeof source !== "function") {
      if (connection === null && !deadWorkers.has(source)) connection = connect(source, false);
      return connection !== null && !deadWorkers.has(connection.worker) ? connection : null;
    }
    connection?.detach();
    connection = connect(source(), true);
    return connection;
  };

  async function request<T, E>(
    run: (
      client: Omit<Connection["client"], typeof Symbol.dispose>,
    ) => Promise<ManuscriptResult<T, E>>,
  ): Promise<ManuscriptResult<T, E | { stage: "worker"; message: string }>> {
    if (disposed) return workerFailure("The engine has been disposed");
    try {
      const current = acquire();
      if (current === null) return workerFailure("The worker is no longer available");

      return await callWithAbort(current.client, signal, run);
    } catch (cause) {
      return workerFailure(describeCause(cause));
    }
  }

  return {
    process: (input) => request((client) => client.process(input)),
    proofread: (input) => request((client) => client.proofread(input)),
    dispose: () => {
      disposed = true;
      connection?.detach();
      connection = null;
    },
  };
}
