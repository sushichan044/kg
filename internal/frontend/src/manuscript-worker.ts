export const createManuscriptWorker = () =>
  new Worker(new URL("./kg.worker.ts", import.meta.url), { type: "module" });
