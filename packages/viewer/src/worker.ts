import { exposeApi } from "kg-worker-rpc/worker";

import { createManuscriptPipeline } from "./manuscript-pipeline";
import type { ManuscriptPipeline, ManuscriptWorkerOptions } from "./manuscript-pipeline";

export type { ManuscriptWorkerOptions } from "./manuscript-pipeline";

export type ManuscriptWorkerApi = Pick<ManuscriptPipeline, "process" | "proofread">;

/**
 * Start the manuscript service inside a dedicated Web Worker.
 */
export function startManuscriptWorker(options?: ManuscriptWorkerOptions): void {
  const { process, proofread } = createManuscriptPipeline(options);
  exposeApi({ process, proofread } satisfies ManuscriptWorkerApi);
}
