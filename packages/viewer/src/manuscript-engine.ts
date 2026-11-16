import { ManuscriptResult } from "@sushichan044/kg-core";
import { connectWorker } from "kg-worker-rpc";
import type { WorkerClient } from "kg-worker-rpc";

import { createManuscriptPipeline } from "./manuscript-pipeline";
import type { ManuscriptInput, ManuscriptOutcome } from "./manuscript-pipeline";
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

function workerFailure(message: string): ManuscriptOutcome {
  return ManuscriptResult.fail({ stage: "worker", message });
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
  // 死んだとき、待っているすべての要求を失敗にするために解決する
  died: Promise<string>;
  detach: () => void;
}>;

function connect(worker: Worker, owned: boolean): Connection {
  let resolve: (message: string) => void = () => {};
  const died = new Promise<string>((done) => {
    resolve = done;
  });
  // connectWorker は messageerror でも Worker を止めるので、error と同じく死んだものとして扱う
  const onError = (event: Event) => {
    deadWorkers.add(worker);
    if (event instanceof ErrorEvent && event.message !== "") resolve(event.message);
    else if (event.type === "messageerror") resolve("The worker could not read a message");
    else resolve("The worker failed to load");
  };
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
    died,
    detach: () => {
      worker.removeEventListener("error", onError);
      worker.removeEventListener("messageerror", onError);
      if (owned) {
        shared[Symbol.dispose]();
      }
    },
  };
}

/**
 * Worker に要求を送るエンジン
 * 関数を渡されたときは Worker が死ぬたびに次の要求で作り直し、Worker を渡されたときは作り直せない
 */
export function createWorkerEngine(source: ManuscriptWorkerSource): ManuscriptEngine {
  let connection: Connection | null = null;
  let disposed = false;

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

  return {
    process: async (input) => {
      if (disposed) return workerFailure("The engine has been disposed");
      let current: Connection | null;
      try {
        current = acquire();
      } catch (cause) {
        return workerFailure(describeCause(cause));
      }
      if (current === null) return workerFailure("The worker is no longer available");
      try {
        const outcome = await Promise.race([
          current.client.process(input),
          current.died.then((message): never => {
            throw new Error(message);
          }),
        ]);
        return outcome;
      } catch (cause) {
        return workerFailure(describeCause(cause));
      }
    },
    dispose: () => {
      disposed = true;
      connection?.detach();
      connection = null;
    },
  };
}
