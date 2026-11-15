import { zipSync } from "fflate";
import { transfer } from "kg-worker-rpc";
import { exposeApi } from "kg-worker-rpc/worker";

import { monochromePng } from "./png-encoder";

// PNG は書き出しが終わるまでメインへ返さず、この Worker に溜める。
// 600 dpi の ImageData は RGBA で 1 ページ数十 MB あるが、PNG は 1 ビットなので数百 KB で済む。
// 返すと PNG ごとにコピーが 2 回（返送と zip 用の再送）増えるので、zip までここで完結させる。
const pngs = new Map<string, Uint8Array>();

const api = {
  addPage(name: string, pixels: ArrayBuffer, width: number, height: number): void {
    const data = new Uint8ClampedArray(pixels);
    pngs.set(name, monochromePng({ width, height, data }));
  },
  zip(): Uint8Array<ArrayBuffer> {
    const bytes = zipSync(Object.fromEntries(pngs), { level: 0 });
    pngs.clear();
    return transfer(bytes, [bytes.buffer]);
  },
};

exposeApi(api);

export type Api = typeof api;
