import * as Comlink from "comlink";

export function exposeApi<T>(api: T): void {
  Comlink.expose(api);
}
