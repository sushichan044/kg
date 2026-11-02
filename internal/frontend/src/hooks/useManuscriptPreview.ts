import type { ReadyTypography, TypographyState } from "@sushichan044/kg-viewer";
import { useMemo } from "react";

import type { ManuscriptPreferences } from "../lib/storage";
import { ProcessManuscriptError, processManuscript } from "../manuscript";
import type { ProcessedManuscript } from "../manuscript";
import type { DocumentContent, DocumentRequest } from "./useDocuments";

export type PreviewState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{
      kind: "typography";
      state: Exclude<TypographyState, { kind: "ready" }> & { retry: () => void };
    }>
  | Readonly<{ kind: "failed"; message: string; retry: boolean }>
  | Readonly<{
      kind: "ready";
      processed: ProcessedManuscript;
      typography: ReadyTypography;
      refreshFailed: boolean;
    }>;

export type PreviewResource = Readonly<{
  promise: Promise<DocumentContent>;
  compose: (content: DocumentContent) => PreviewState;
}>;

export function useManuscriptPreview(
  request: DocumentRequest | null,
  preferences: ManuscriptPreferences,
  typographyState: TypographyState & { retry: () => void },
) {
  const typography = typographyState.kind === "ready" ? typographyState.typography : null;
  const { composition, notation } = preferences;
  const compose = useMemo(() => {
    if (typography === null) return null;
    const cache = new WeakMap<DocumentContent, PreviewState>();
    return (content: DocumentContent): PreviewState => {
      const cached = cache.get(content);
      if (cached !== undefined) return cached;
      const text = content.kind === "ready" ? content.text : content.previousText;
      if (text === null)
        return { kind: "failed", message: "本文の取得に失敗しました", retry: true };
      const result = processManuscript(text, composition, notation, typography.composer);
      const preview: PreviewState = result.ok
        ? {
            kind: "ready",
            processed: result.value,
            typography,
            refreshFailed: content.kind === "failed",
          }
        : { kind: "failed", message: ProcessManuscriptError.describe(result.error), retry: false };
      cache.set(content, preview);
      return preview;
    };
  }, [typography, composition, notation]);
  const previewResource =
    request !== null && compose !== null ? { promise: request.promise, compose } : null;
  return {
    previewResource,
    preview:
      typographyState.kind === "ready"
        ? { kind: "loading" as const }
        : { kind: "typography" as const, state: typographyState },
  };
}
