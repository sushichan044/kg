import { startTransition, useCallback, useEffect, useRef, useState } from "react";

import { fetchContent, fetchFiles } from "../lib/api";
import type { FileEntry } from "../lib/api";

type CatalogState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "failed" }>
  | Readonly<{ kind: "ready"; files: readonly FileEntry[]; refreshFailed: boolean }>;

export function useFileCatalog() {
  const [catalog, setCatalog] = useState<CatalogState>({ kind: "loading" });
  const request = useRef(0);
  const refresh = useCallback(() => {
    const current = ++request.current;
    return fetchFiles().then(
      (files) => {
        if (current === request.current) setCatalog({ kind: "ready", files, refreshFailed: false });
      },
      () => {
        if (current !== request.current) return;
        setCatalog((previous) =>
          previous.kind === "ready" ? { ...previous, refreshFailed: true } : { kind: "failed" },
        );
      },
    );
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      request.current += 1;
    };
  }, [refresh]);

  return { catalog, refresh };
}

export type DocumentContent =
  | Readonly<{ kind: "ready"; text: string }>
  | Readonly<{ kind: "failed"; previousText: string | null }>;

export type DocumentRequest = Readonly<{
  id: string;
  promise: Promise<DocumentContent>;
}>;

/**
 * Keep requests outside the tree that suspends, including its initial mount.
 */
export function useDocumentRequest(id: string | null) {
  const [request, setRequest] = useState<DocumentRequest | null>(null);
  const active = useRef<AbortController | null>(null);
  const lastContent = useRef<Readonly<{ id: string; text: string }> | null>(null);

  const load = useCallback((fileId: string) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const promise = fetchContent(fileId, controller.signal).then<DocumentContent, DocumentContent>(
      (text) => {
        if (!controller.signal.aborted) lastContent.current = { id: fileId, text };
        return { kind: "ready", text };
      },
      () => ({
        kind: "failed",
        previousText: lastContent.current?.id === fileId ? lastContent.current.text : null,
      }),
    );
    setRequest({ id: fileId, promise });
  }, []);

  useEffect(() => {
    if (id !== null) load(id);
    return () => {
      active.current?.abort();
    };
  }, [id, load]);

  const refresh = useCallback(() => {
    if (id !== null)
      startTransition(() => {
        load(id);
      });
  }, [id, load]);

  return { request: request?.id === id ? request : null, refresh };
}
