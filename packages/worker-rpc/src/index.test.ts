import { describe, expect, test } from "vite-plus/test";

import { connectApi, exposeApi, transfer } from "./index";

const api = {
  add: (left: number, right: number) => left + right,
  fail: (): never => {
    throw new Error("boom");
  },
  sum: (bytes: Uint8Array) => bytes.reduce((total, byte) => total + byte, 0),
  double: (bytes: Uint8Array) => {
    const result = bytes.map((byte) => byte * 2);
    return transfer(result, [result.buffer]);
  },
};

const connected = test.extend<{ connection: ReturnType<typeof connectApi<typeof api>> }>({
  connection: async ({}, use) => {
    const { port1, port2 } = new MessageChannel();
    exposeApi(api, port1);
    const connection = connectApi<typeof api>(port2);
    await use(connection);
    connection.close();
    port1.close();
  },
});

describe("worker-rpc", () => {
  connected("returns values with their declared types", async ({ connection }) => {
    // Arrange
    const { api: remote } = connection;

    // Act
    const sum = await remote.add(1, 2);

    // Assert
    expect(sum).toBe(3);
  });

  connected("propagates errors thrown in the worker side", async ({ connection }) => {
    // Arrange
    const { api: remote } = connection;

    // Act
    const call = remote.fail();

    // Assert
    await expect(call).rejects.toThrow("boom");
  });

  connected("moves transferred buffers instead of copying them", async ({ connection }) => {
    // Arrange
    const bytes = new Uint8Array([1, 2, 3]);

    // Act
    const sum = await connection.api.sum(transfer(bytes, [bytes.buffer]));

    // Assert
    expect(sum).toBe(6);
    expect(bytes.byteLength).toBe(0);
  });

  connected("receives transferred results", async ({ connection }) => {
    // Arrange
    const bytes = new Uint8Array([1, 2, 3]);

    // Act
    const doubled = await connection.api.double(bytes);

    // Assert
    expect([...doubled]).toEqual([2, 4, 6]);
  });
});
