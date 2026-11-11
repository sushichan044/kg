import { exposeApi, transfer } from "@sushichan044/kg-worker-rpc";
import { zipSync } from "fflate";

import { monochromePng } from "./png";
import type { PageEncoderApi } from "./protocol";

/**
 * 書き出しの Worker のコード側で呼ぶ。PNG のエンコードと zip への梱包を引き受け、
 * `exportPages` から呼べるようにする。
 */
export function definePageEncoderWorker(endpoint?: Worker | MessagePort): void {
  const api: PageEncoderApi = {
    encodePage: (image) => {
      const png = monochromePng(image);
      return transfer(png, [png.buffer]);
    },
    zip: (files) => {
      const bytes = zipSync({ ...files }, { level: 0 });
      return transfer(bytes, [bytes.buffer]);
    },
  };
  exposeApi(api, endpoint);
}
