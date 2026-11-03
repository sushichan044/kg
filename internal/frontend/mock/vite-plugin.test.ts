import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createServer } from "vite-plus";
import { expect, test as base, vi } from "vite-plus/test";

import type { FileEntry } from "../src/lib/api";
import { mockFrontend } from "./vite-plugin";

const source = "　雨上がりの道を歩く。\n";

const test = base.extend<{ mock: { directory: string; origin: string } }>({
  mock: async ({}, use) => {
    const directory = await mkdtemp(join(tmpdir(), "kg-frontend-mock-"));
    await mkdir(join(directory, "chapters"));
    await writeFile(join(directory, "novel.txt"), source);
    await writeFile(join(directory, "chapters", "notes.md"), "Not a manuscript");
    const server = await createServer({
      configFile: false,
      root: directory,
      logLevel: "silent",
      plugins: [mockFrontend(directory)],
      optimizeDeps: { noDiscovery: true },
      server: { host: "127.0.0.1", port: 0, hmr: false },
    });

    try {
      await server.listen();
      const address = server.httpServer?.address();
      expect.assert(address !== undefined && address !== null && typeof address !== "string");
      await vi.waitFor(() => {
        expect(Object.values(server.watcher.getWatched()).flat()).toContain("novel.txt");
      });
      await use({ directory, origin: `http://127.0.0.1:${address.port}` });
    } finally {
      await server.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
});

test("serves the fixture catalog and manuscript text through the application API", async ({
  mock,
}) => {
  const response = await fetch(`${mock.origin}/_/api/files`);
  const files: FileEntry[] = await response.json();
  const file = files[0];
  expect.assert(file !== undefined);

  const content = await fetch(`${mock.origin}/_/api/files/${file.id}/content`);

  expect(response.status).toBe(200);
  expect(files).toEqual([{ id: file.id, path: "novel.txt" }]);
  expect(content.status).toBe(200);
  expect(await content.text()).toBe(source);
});

test("returns an empty catalog when the fixture directory has no manuscripts", async ({ mock }) => {
  await rm(join(mock.directory, "novel.txt"));

  const response = await fetch(`${mock.origin}/_/api/files`);

  expect(await response.json()).toEqual([]);
});

test("rejects unknown manuscripts and writes to the mock API", async ({ mock }) => {
  const missing = await fetch(`${mock.origin}/_/api/files/missing/content`);
  const write = await fetch(`${mock.origin}/_/api/files`, { method: "POST" });

  expect(missing.status).toBe(404);
  expect(write.status).toBe(405);
  expect(write.headers.get("allow")).toBe("GET");
});

test(
  "streams fixture edits, additions, and removals through SSE",
  { timeout: 10_000 },
  async ({ mock }) => {
    const response = await fetch(`${mock.origin}/_/events`, { signal: AbortSignal.timeout(8_000) });
    expect.assert(response.body !== null);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const readEvent = async (name: string): Promise<string> => {
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const event = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (event.startsWith(`event: ${name}\n`)) return event;
        boundary = buffer.indexOf("\n\n");
      }
      const { value, done } = await reader.read();
      if (done) throw new Error("SSE stream ended before the expected event");
      buffer += decoder.decode(value, { stream: true });
      return readEvent(name);
    };

    try {
      expect(response.headers.get("content-type")).toBe("text/event-stream");
      expect(await readEvent("started")).toContain('"pid":');
      const files: FileEntry[] = await (await fetch(`${mock.origin}/_/api/files`)).json();
      const file = files[0];
      expect.assert(file !== undefined);

      await writeFile(join(mock.directory, "novel.txt"), "　本文を直した。\n");
      expect(await readEvent("file-changed")).toContain(JSON.stringify({ id: file.id }));
      const content = await fetch(`${mock.origin}/_/api/files/${file.id}/content`);
      expect(await content.text()).toBe("　本文を直した。\n");

      const added = join(mock.directory, "chapters", "続き.txt");
      await writeFile(added, "　続きを書く。\n");
      await readEvent("update");
      const addedFiles: FileEntry[] = await (await fetch(`${mock.origin}/_/api/files`)).json();
      expect(addedFiles.map(({ path }) => path)).toContain("chapters/続き.txt");

      await rm(added);
      await readEvent("update");
      const remaining: FileEntry[] = await (await fetch(`${mock.origin}/_/api/files`)).json();
      expect(remaining).toEqual(files);
    } finally {
      await reader.cancel();
    }
  },
);
