import { useTypography } from "@sushichan044/kg-viewer";
import type { ReadyTypography } from "@sushichan044/kg-viewer";
import { Suspense, use, useMemo } from "react";
import { createPortal } from "react-dom";

import { useDocumentRequest } from "../hooks/useDocuments";
import type { DocumentRequest } from "../hooks/useDocuments";
import type { FileEntry } from "../lib/api";
import { ProcessManuscriptError, processManuscript } from "../manuscript";
import { DocumentRegion } from "./DocumentRegion";
import type { DocumentRegionProps, PreviewState } from "./DocumentRegion";

type SessionProps = Omit<DocumentRegionProps, "preview" | "refreshContent" | "selectedFile"> &
  Readonly<{
    selectedFile: FileEntry;
    revision: number;
    summaryTarget: HTMLDivElement | null;
  }>;

export function DocumentSession(props: SessionProps) {
  const { request, refresh } = useDocumentRequest(props.selectedFile.id, props.revision);
  return (
    <TypographySession
      key={props.preferences.composition.appearance.fontPreset}
      {...props}
      request={request}
      refreshContent={refresh}
    />
  );
}

type TypographySessionProps = SessionProps &
  Readonly<{
    request: DocumentRequest | null;
    refreshContent: () => void;
  }>;

function TypographySession(props: TypographySessionProps) {
  const state = useTypography(props.preferences.composition.appearance.fontPreset);
  if (state.kind !== "ready")
    return <DocumentRegion {...props} preview={{ kind: "typography", state }} />;
  const fallback = <DocumentRegion {...props} preview={{ kind: "loading" }} />;
  if (props.request === null) return fallback;
  return (
    <Suspense fallback={fallback}>
      <ComposedDocument {...props} request={props.request} typography={state.typography} />
    </Suspense>
  );
}

function ComposedDocument({
  request,
  typography,
  summaryTarget,
  ...props
}: TypographySessionProps & { request: DocumentRequest; typography: ReadyTypography }) {
  const content = use(request.promise);
  const text = content.kind === "ready" ? content.text : content.previousText;
  const { composition, notation } = props.preferences;
  const result = useMemo(
    () =>
      text === null ? null : processManuscript(text, composition, notation, typography.composer),
    [text, composition, notation, typography],
  );
  const preview: PreviewState =
    result === null
      ? { kind: "failed", message: "本文の取得に失敗しました", retry: true }
      : result.ok
        ? {
            kind: "ready",
            processed: result.value,
            typography,
            refreshFailed: content.kind === "failed",
          }
        : { kind: "failed", message: ProcessManuscriptError.describe(result.error), retry: false };
  const compositionKey = JSON.stringify([request.version, composition, notation]);
  // Keep the summary in the settings sheet without duplicating composition or lifting its result into state.
  return (
    <>
      <DocumentRegion key={compositionKey} {...props} preview={preview} />
      {preview.kind === "ready" &&
        summaryTarget !== null &&
        createPortal(
          <p className="mobile-summary">
            {preview.processed.composed.layout.stats.chars}字・
            {preview.processed.composed.layout.stats.pages}ページ
          </p>,
          summaryTarget,
        )}
    </>
  );
}
