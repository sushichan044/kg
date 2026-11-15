import { expect, test as base, vi } from "vite-plus/test";

import type { CalcApi } from "./fixtures/calc.worker";
const createWorker = () =>
  new Worker(new URL("./fixtures/calc.worker.ts", import.meta.url), { type: "module" });
import { callWithAbort, closeWorker, connectWorker, transfer, WorkerClosedError } from "./index";
import type { WorkerClient } from "./index";

const test = base.extend<{ client: WorkerClient<CalcApi> }>({
  client: async ({}, use) => {
    const client = connectWorker<CalcApi>(createWorker());
    await use(client);
    client[Symbol.dispose]();
  },
});

test("calls the worker API with typed arguments and results", async ({ client }) => {
  const sum = await client.add(1, 2);

  expect(sum).toBe(3);
});

test("rejects with the error thrown in the worker", async ({ client }) => {
  await expect(client.fail("boom")).rejects.toThrow("boom");
});

test("detaches a transferred buffer on the sender side", async ({ client }) => {
  const buffer = new ArrayBuffer(8);

  const length = await client.byteLength(transfer(buffer, [buffer]));

  expect(length).toBe(8);
  expect(buffer.byteLength).toBe(0);
});

test("copies a buffer that is not transferred", async ({ client }) => {
  const buffer = new ArrayBuffer(8);

  await client.byteLength(buffer);

  expect(buffer.byteLength).toBe(8);
});

test("terminates the worker once on dispose", () => {
  const worker = createWorker();
  const terminate = vi.spyOn(worker, "terminate");
  const client = connectWorker<CalcApi>(worker);

  client[Symbol.dispose]();
  client[Symbol.dispose]();

  expect(terminate).toHaveBeenCalledTimes(1);
});

test("supports `using` for automatic disposal", async () => {
  const worker = createWorker();
  const terminate = vi.spyOn(worker, "terminate");

  {
    using client = connectWorker<CalcApi>(worker);
    expect(await client.add(2, 3)).toBe(5);
  }

  expect(terminate).toHaveBeenCalledTimes(1);
});

test("rejects a pending call with the abort reason", async ({ client }) => {
  const controller = new AbortController();
  const reason = new Error("cancelled");
  const pending = callWithAbort(client, controller.signal, (remote) => remote.neverResolves());

  controller.abort(reason);

  await expect(pending).rejects.toBe(reason);
});

test("terminates the worker on abort", async () => {
  const worker = createWorker();
  const terminate = vi.spyOn(worker, "terminate");
  const client = connectWorker<CalcApi>(worker);
  const controller = new AbortController();
  const pending = callWithAbort(client, controller.signal, (remote) => remote.neverResolves());

  controller.abort(new Error("cancelled"));
  await pending.catch(() => {});

  expect(terminate).toHaveBeenCalledTimes(1);
});

test("rejects immediately when the signal is already aborted", async ({ client }) => {
  const signal = AbortSignal.abort(new Error("already"));

  await expect(callWithAbort(client, signal, (remote) => remote.add(1, 1))).rejects.toThrow(
    "already",
  );
});

test("keeps the worker alive when the call completes before abort", async ({ client }) => {
  const controller = new AbortController();

  const sum = await callWithAbort(client, controller.signal, (remote) => remote.add(1, 2));
  controller.abort();

  expect(sum).toBe(3);
  expect(await client.add(2, 2)).toBe(4);
});

test("rejects every pending call on the client when one of them is aborted", async ({ client }) => {
  const first = new AbortController();
  const second = new AbortController();
  const reason = new Error("cancelled");
  const aborted = callWithAbort(client, first.signal, (remote) => remote.neverResolves());
  const other = callWithAbort(client, second.signal, (remote) => remote.neverResolves());

  first.abort(reason);

  await expect(aborted).rejects.toBe(reason);
  await expect(other).rejects.toBeInstanceOf(WorkerClosedError);
});

test("rejects a pending call when the client is disposed", async ({ client }) => {
  const pending = callWithAbort(client, new AbortController().signal, (remote) =>
    remote.neverResolves(),
  );

  client[Symbol.dispose]();

  await expect(pending).rejects.toThrow(WorkerClosedError);
});

test("rejects a call on a client that is already disposed", async ({ client }) => {
  client[Symbol.dispose]();

  const result = callWithAbort(client, new AbortController().signal, (remote) => remote.add(1, 1));

  await expect(result).rejects.toThrow(WorkerClosedError);
});

test("rejects a pending call when the worker throws at top level", async () => {
  const worker = new Worker(new URL("./fixtures/crash.worker.ts", import.meta.url), {
    type: "module",
  });
  const terminate = vi.spyOn(worker, "terminate");
  using client = connectWorker<CalcApi>(worker);

  const result = callWithAbort(client, new AbortController().signal, (remote) =>
    remote.neverResolves(),
  );

  await expect(result).rejects.toThrow(WorkerClosedError);
  expect(terminate).toHaveBeenCalledTimes(1);
});

test("rejects a pending call when the worker script fails to load", async () => {
  const worker = new Worker(new URL("./fixtures/missing.worker.js", import.meta.url), {
    type: "module",
  });
  using client = connectWorker<CalcApi>(worker);

  const result = callWithAbort(client, new AbortController().signal, (remote) => remote.add(1, 1));

  await expect(result).rejects.toThrow(WorkerClosedError);
});

test("terminates the worker and rejects pending calls with closeWorker", async () => {
  const worker = createWorker();
  const terminate = vi.spyOn(worker, "terminate");
  const client = connectWorker<CalcApi>(worker);
  const pending = callWithAbort(client, new AbortController().signal, (remote) =>
    remote.neverResolves(),
  );

  closeWorker(client);
  client[Symbol.dispose]();

  await expect(pending).rejects.toThrow(WorkerClosedError);
  expect(terminate).toHaveBeenCalledTimes(1);
});
