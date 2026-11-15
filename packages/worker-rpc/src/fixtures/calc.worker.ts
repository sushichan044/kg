import { exposeApi } from "../worker";

const api = {
  add: (a: number, b: number) => a + b,
  byteLength: (buffer: ArrayBuffer) => buffer.byteLength,
  neverResolves: () => new Promise<never>(() => {}),
  fail: (message: string): never => {
    throw new Error(message);
  },
};

export type CalcApi = typeof api;

exposeApi(api);
