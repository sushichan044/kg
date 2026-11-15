import * as Comlink from "comlink";

export { transfer } from "comlink";

export type WorkerClient<T> = Comlink.Remote<T> & Disposable;

export class WorkerClosedError extends Error {
  override name = "WorkerClosedError";
}

type ClientState = {
  closedBy: WorkerClosedError | null;
  // Comlink は終了した Worker への呼び出しを reject しないので、応答待ちの callWithAbort は閉じるときにここから reject する
  readonly pending: Set<(reason: unknown) => void>;
  readonly close: (error: WorkerClosedError) => void;
};

const states = new WeakMap<object, ClientState>();

/**
 * Worker を Comlink でラップし、`using` か {@link closeWorker} で閉じられるクライアントを返す。
 * ネイティブの `Symbol.dispose` が無いブラウザーを対象にするなら、`using` ではなく try/finally で {@link closeWorker} を呼ぶ。
 */
export function connectWorker<T>(worker: Worker): WorkerClient<T> {
  const remote = Comlink.wrap<T>(worker);

  const onError = (event: Event) => {
    const detail = event instanceof ErrorEvent ? `: ${event.message}` : "";
    state.close(new WorkerClosedError(`worker stopped${detail}`, { cause: event }));
  };
  const state: ClientState = {
    closedBy: null,
    pending: new Set(),
    close(error) {
      if (state.closedBy !== null) return;
      state.closedBy = error;
      worker.removeEventListener("error", onError);
      worker.removeEventListener("messageerror", onError);
      remote[Comlink.releaseProxy]();
      worker.terminate();
      for (const reject of state.pending) reject(error);
      state.pending.clear();
    },
  };
  // スクリプトの読み込み失敗やトップレベルの例外では、Comlink の応答が来ないまま Worker が止まる
  worker.addEventListener("error", onError);
  worker.addEventListener("messageerror", onError);

  const dispose = () => {
    closeWorker(client);
  };

  // Comlink の proxy は未知のプロパティをすべて RPC 呼び出しにするので、Symbol.dispose だけ proxy を通さない
  const client = new Proxy(remote, {
    get(target, property, receiver) {
      if (property === Symbol.dispose) return dispose;
      return Reflect.get(target, property, receiver);
    },
  }) as WorkerClient<T>;
  states.set(client, state);
  return client;
}

/**
 * Worker を止め、応答待ちの {@link callWithAbort} を WorkerClosedError で reject する。`using` と同じ処理で、何度呼んでもよい。
 */
export function closeWorker<T>(client: WorkerClient<T>): void {
  stateOf(client).close(new WorkerClosedError("worker client was disposed"));
}

function stateOf(client: object): ClientState {
  const state = states.get(client);
  if (state === undefined) throw new TypeError("client was not created by connectWorker");
  return state;
}

// Comlink は AbortSignal を渡せず、終了した Worker への呼び出しは永久に解決しないので、abort やクライアントを閉じたときはここで reject する
// 中断した Worker は再利用できないので、abort するとクライアントごと閉じ、応答待ちの他の呼び出しも WorkerClosedError で reject する
export async function callWithAbort<T, R>(
  client: WorkerClient<T>,
  signal: AbortSignal,
  run: (remote: Comlink.Remote<T>) => Promise<R>,
): Promise<R> {
  signal.throwIfAborted();
  const state = stateOf(client);
  if (state.closedBy !== null) throw state.closedBy;

  const { promise: interrupted, reject } = Promise.withResolvers<never>();
  const onAbort = () => {
    // 閉じる前に reject しないと、この呼び出しが abort の理由ではなく WorkerClosedError で reject される
    reject(signal.reason);
    state.close(
      new WorkerClosedError("worker client was disposed because another call was aborted"),
    );
  };
  state.pending.add(reject);
  signal.addEventListener("abort", onAbort, { once: true });

  try {
    return await Promise.race([run(client), interrupted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
    state.pending.delete(reject);
  }
}
