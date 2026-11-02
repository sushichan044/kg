import { startTransition, useCallback, useEffect, useRef, useState } from "react";

import { fetchContent, fetchFiles } from "../lib/api";
import type { FileEntry } from "../lib/api";

type CatalogState =
  | Readonly<{ kind: "loading"; selectedPath: string | null }>
  | Readonly<{ kind: "failed"; selectedPath: string | null }>
  | Readonly<{
      kind: "ready";
      files: readonly FileEntry[];
      selectedPath: string | null;
      refreshFailed: boolean;
    }>;

export function useFileCatalog(initialSelectedPath: () => string | null) {
  const [catalog, setCatalog] = useState<CatalogState>(() => ({
    kind: "loading",
    selectedPath: initialSelectedPath(),
  }));
  const request = useRef(0);
  const refresh = useCallback(() => {
    const current = ++request.current;
    return fetchFiles().then(
      (files) => {
        if (current !== request.current) return;
        setCatalog((previous) => ({
          kind: "ready",
          files,
          refreshFailed: false,
          selectedPath:
            files.find((file) => file.path === previous.selectedPath)?.path ??
            files[0]?.path ??
            null,
        }));
      },
      () => {
        if (current !== request.current) return;
        setCatalog((previous) =>
          previous.kind === "ready"
            ? { ...previous, refreshFailed: true }
            : { kind: "failed", selectedPath: previous.selectedPath },
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

  const select = useCallback((selectedPath: string) => {
    setCatalog((previous) => ({ ...previous, selectedPath }));
  }, []);
  return { catalog, refresh, select };
}

export type DocumentContent =
  | Readonly<{ kind: "ready"; text: string }>
  | Readonly<{ kind: "failed"; previousText: string | null }>;

export type DocumentRequest = Readonly<{
  promise: Promise<DocumentContent>;
  version: string;
}>;

/**
 * Own one file's requests; the file session is keyed by its ID.
 */
export function useDocumentRequest(id: string, revision: number) {
  const [request, setRequest] = useState<DocumentRequest | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lastText = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const promise = fetchContent(id, controller.signal).then<DocumentContent, DocumentContent>(
      (text) => {
        if (!controller.signal.aborted) lastText.current = text;
        return { kind: "ready", text };
      },
      () => ({ kind: "failed", previousText: lastText.current }),
    );
    startTransition(() => {
      setRequest({ promise, version: `${revision}:${attempt}` });
    });
    return () => {
      controller.abort();
    };
  }, [id, revision, attempt]);

  return {
    request,
    refresh: () => {
      setAttempt((value) => value + 1);
    },
  };
}
