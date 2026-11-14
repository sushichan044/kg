import type { NovelComposedManuscript } from "@sushichan044/kg-core";
import { NovelViewer } from "@sushichan044/kg-viewer";
import type { ReadyTypography } from "@sushichan044/kg-viewer";
import { useEffect, useEffectEvent, useRef } from "react";

import { downloadZip } from "../lib/download";
import { createExportWorker } from "../lib/workers";

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

// React Compiler は import() 式を扱えないので、コンポーネントの外に置く
const loadExportPages = () => import("@sushichan044/kg-viewer/worker/export");

export function ExportJob({ request, onFinish }: ExportJobProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const finish = useEffectEvent((error: string | null) => {
    onFinish(error);
  });

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;
    const controller = new AbortController();
    void loadExportPages()
      .then(({ exportPages }) => {
        controller.signal.throwIfAborted();
        return exportPages({
          host,
          composed: request.composed,
          typography: request.typography,
          createWorker: createExportWorker,
          signal: controller.signal,
        });
      })
      .then((zip) => {
        if (controller.signal.aborted) return;
        downloadZip(zip, request.filename);
        finish(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          finish(error instanceof Error ? error.message : "画像を生成できませんでした");
      });
    return () => {
      controller.abort();
    };
  }, [request]);

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
