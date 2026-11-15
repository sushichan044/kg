import * as Comlink from "comlink";

export { transfer } from "comlink";

export type WorkerClient<T> = Comlink.Remote<T> & Disposable;

export function connectWorker<T>(worker: Worker): WorkerClient<T> {
  const remote = Comlink.wrap<T>(worker);
  let disposed = false;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    remote[Comlink.releaseProxy]();
    worker.terminate();
  };

  // Comlink の proxy は未知のプロパティをすべて RPC 呼び出しにするので、Symbol.dispose だけ proxy を通さない
  return new Proxy(remote, {
    get(target, property, receiver) {
      if (property === Symbol.dispose) return dispose;
      return Reflect.get(target, property, receiver);
    },
  }) as WorkerClient<T>;
}

// Comlink は AbortSignal を渡せず、terminate 後の呼び出しは永久に解決しないので、abort 時はここで reject する
export async function callWithAbort<T, R>(
  client: WorkerClient<T>,
  signal: AbortSignal,
  run: (remote: Comlink.Remote<T>) => Promise<R>,
): Promise<R> {
  signal.throwIfAborted();

  const { promise: aborted, reject } = Promise.withResolvers<never>();
  const onAbort = () => {
    client[Symbol.dispose]();
    reject(signal.reason);
  };
  signal.addEventListener("abort", onAbort, { once: true });

  try {
    return await Promise.race([run(client), aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
