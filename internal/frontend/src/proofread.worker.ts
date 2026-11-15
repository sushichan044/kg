import type { NovelComposedManuscript } from "@sushichan044/kg-core";
import { createDefaultProofreadingRules, proofreadManuscript } from "@sushichan044/kg-core/lint";
import { exposeApi } from "kg-worker-rpc/worker";

// ルールは関数を含み structured clone できないので、メインから受け取らず Worker 内で作る
const rules = createDefaultProofreadingRules();

const api = {
  proofread: (composed: NovelComposedManuscript) => proofreadManuscript(composed, { rules }),
};

export type Api = typeof api;

exposeApi(api);
