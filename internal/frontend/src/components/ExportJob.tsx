import type { NovelComposedManuscript } from "@sushichan044/kg-core";
import { NovelViewer } from "@sushichan044/kg-viewer";
import type { ReadyTypography } from "@sushichan044/kg-viewer";
import { useEffect, useRef } from "react";

export type ExportRequest = Readonly<{
  composed: NovelComposedManuscript;
  typography: ReadyTypography;
  startPageSide: "left" | "right";
  filename: string;
}>;

type ExportJobProps = Readonly<{
  request: ExportRequest;
  onFinish: (error: string | null) => void;
}>;

export function ExportJob({ request, onFinish }: ExportJobProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;
    const controller = new AbortController();
    void import("../lib/export-pages")
      .then(({ exportPages }) => {
        controller.signal.throwIfAborted();
        return exportPages(
          host,
          request.composed,
          request.typography,
          request.filename,
          controller.signal,
        );
      })
      .then(() => {
        if (!controller.signal.aborted) onFinish(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          onFinish(error instanceof Error ? error.message : "画像を生成できませんでした");
      });
    return () => {
      controller.abort();
    };
  }, [request, onFinish]);

  return (
    <div ref={hostRef} className="export-pages" aria-hidden="true">
      <NovelViewer
        composed={request.composed}
        typography={request.typography}
        startPageSide={request.startPageSide}
        showGrid={false}
      />
    </div>
  );
}
