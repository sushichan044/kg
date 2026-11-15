import { exposeApi } from "kg-worker-rpc/worker";

import { createManuscriptPipeline } from "./manuscript-pipeline";

const pipeline = createManuscriptPipeline();

const api = { process: pipeline.process };

export type ManuscriptWorkerApi = typeof api;

exposeApi(api);
