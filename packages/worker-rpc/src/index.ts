import * as Comlink from "comlink";

/**
 * Worker 側が公開する API。structured clone できる値だけを受け渡す。
 */
type RpcApi = Readonly<Record<string, (...args: never[]) => unknown>>;

/**
 * `using` で束縛すると、スコープを抜けるときに `close` を呼ぶ。
 */
interface RpcConnection<TApi extends RpcApi> extends Disposable {
  readonly api: Comlink.Remote<TApi>;
  /**
   * 通信を閉じる。Worker なら terminate して処理を止め、MessagePort なら close する。
   */
  close(): void;
}

/**
 * Worker 側で API を公開する。`endpoint` を省くと Worker 自身のグローバルスコープを使う。
 */
export function exposeApi<TApi extends RpcApi>(api: TApi, endpoint?: Comlink.Endpoint): void {
  Comlink.expose(api, endpoint);
}

/**
 * Main 側から、Worker が公開した API を型付きで呼べるようにする。
 */
export function connectApi<TApi extends RpcApi>(endpoint: Comlink.Endpoint): RpcConnection<TApi> {
  const api = Comlink.wrap<TApi>(endpoint);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    api[Comlink.releaseProxy]();
    closeEndpoint(endpoint);
  };
  return { api, close, [Symbol.dispose]: close };
}

/**
 * 値をコピーせず所有権ごと相手に渡す。渡した ArrayBuffer などは送り側で使えなくなる。
 */
export function transfer<TValue>(value: TValue, transferables: readonly Transferable[]): TValue {
  return Comlink.transfer(value, [...transferables]);
}

/**
 * `signal` の abort を待つ。`using` で束縛すると、スコープを抜けるときに待つのをやめる。
 */
export function onAbort(signal: AbortSignal, listener: () => void): Disposable {
  signal.addEventListener("abort", listener, { once: true });
  return {
    [Symbol.dispose]: () => {
      signal.removeEventListener("abort", listener);
    },
  };
}

function closeEndpoint(endpoint: Comlink.Endpoint): void {
  // Worker は terminate、MessagePort は close を持つ。どちらも持たない端点は何もしない。
  const terminate: unknown = Reflect.get(endpoint, "terminate");
  if (typeof terminate === "function") {
    Reflect.apply(terminate, endpoint, []);
    return;
  }
  const close: unknown = Reflect.get(endpoint, "close");
  if (typeof close === "function") Reflect.apply(close, endpoint, []);
}
