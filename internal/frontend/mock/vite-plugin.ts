import { Buffer } from "node:buffer";
import { readFile, readdir } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, relative, resolve, sep } from "node:path";
import process from "node:process";

import type { Plugin } from "vite-plus";

import type { FileEntry } from "../src/lib/api";

const fileId = (path: string) => Buffer.from(path).toString("base64url");

async function catalog(root: string): Promise<FileEntry[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".txt"))
    .map((entry) => {
      const path = relative(root, join(entry.parentPath, entry.name)).split(sep).join("/");
      return { id: fileId(path), path };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function sendEvent(response: ServerResponse, event: string, data: unknown) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function mockFrontend(directory = join(import.meta.dirname, "manuscripts")): Plugin {
  const root = resolve(directory);
  const clients = new Set<ServerResponse>();
  let stopWatching = () => {};

  async function respond(request: IncomingMessage, response: ServerResponse, pathname: string) {
    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" }).end();
      return;
    }
    if (pathname === "/_/events") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      clients.add(response);
      response.on("close", () => clients.delete(response));
      sendEvent(response, "started", { pid: process.pid });
      return;
    }
    const files = await catalog(root);
    if (pathname === "/_/api/files") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(files));
      return;
    }
    const id = /^\/_\/api\/files\/([^/]+)\/content$/.exec(pathname)?.[1];
    const file = files.find((entry) => entry.id === id);
    if (file === undefined) {
      response.writeHead(404).end();
      return;
    }
    const content = await readFile(join(root, file.path), "utf8");
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(content);
  }

  return {
    name: "kg-frontend-mock",
    apply: "serve",
    configureServer(server) {
      const onFileEvent = (event: string, file: string) => {
        if (!file.startsWith(`${root}${sep}`) || !file.endsWith(".txt")) return;
        const path = relative(root, file).split(sep).join("/");
        if (event !== "change" && event !== "add" && event !== "unlink") return;
        for (const client of clients) {
          sendEvent(client, event === "change" ? "file-changed" : "update", {
            id: fileId(path),
          });
        }
      };
      server.watcher.add(root);
      server.watcher.on("all", onFileEvent);
      stopWatching = () => {
        server.watcher.off("all", onFileEvent);
      };
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://mock.local").pathname;
        if (!pathname.startsWith("/_/")) {
          next();
          return;
        }
        // oxlint-disable-next-line promise/no-callback-in-promise -- 非同期のエラーは Connect が next を通じて処理する。
        void respond(request, response, pathname).catch(next);
      });
    },
    closeBundle() {
      stopWatching();
      for (const client of clients) client.end();
      clients.clear();
    },
  };
}
