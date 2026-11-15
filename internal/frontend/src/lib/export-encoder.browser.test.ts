import type { NovelComposedManuscript } from "@sushichan044/kg-core";
import type { ReadyTypography } from "@sushichan044/kg-viewer";
import { zipSync } from "fflate";
import { callWithAbort, connectWorker, transfer } from "kg-worker-rpc";
import type { WorkerClient } from "kg-worker-rpc";
import { expect, test as base, vi } from "vite-plus/test";

import type { Api } from "./export-encoder.worker";
import { exportPages } from "./export-pages";
import { monochromePng } from "./png-encoder";

const test = base.extend<{ client: WorkerClient<Api> }>({
  client: async ({}, use) => {
    const client = connectWorker<Api>(
      new Worker(new URL("./export-encoder.worker.ts", import.meta.url), { type: "module" }),
    );
    await use(client);
    client[Symbol.dispose]();
  },
});

function createImage(width: number, height: number, seed: number): ImageData {
  const image = new ImageData(width, height);
  for (let index = 0; index < image.data.length; index += 1) {
    image.data[index] = ((index * 31 + seed * 17) ^ (index >> 3)) & 0xff;
  }
  return image;
}

test("produces the same PNGs and zip as the synchronous functions", async ({ client }) => {
  const images = [createImage(37, 11, 1), createImage(8, 8, 2), createImage(1, 5, 3)];
  const expected = zipSync(
    Object.fromEntries(images.map((image, index) => [`${index + 1}.png`, monochromePng(image)])),
    { level: 0 },
  );

  for (const [index, image] of images.entries()) {
    const pixels = new Uint8ClampedArray(image.data).buffer;
    // eslint-disable-next-line no-await-in-loop
    await client.addPage(`${index + 1}.png`, transfer(pixels, [pixels]), image.width, image.height);
  }
  const actual = await client.zip();

  expect(Array.from(actual)).toEqual(Array.from(expected));
});

test("detaches the pixel buffer on the sender side", async ({ client }) => {
  const image = createImage(4, 4, 1);
  const pixels = image.data.buffer;

  await client.addPage("1.png", transfer(pixels, [pixels]), 4, 4);

  expect(pixels.byteLength).toBe(0);
});

test("starts an empty zip after the previous one was taken", async ({ client }) => {
  const image = createImage(2, 2, 1);
  const pixels = image.data.buffer;
  await client.addPage("1.png", transfer(pixels, [pixels]), 2, 2);
  await client.zip();

  const second = await client.zip();

  expect(Array.from(second)).toEqual(Array.from(zipSync({}, { level: 0 })));
});

test("rejects a call in flight when aborted", async ({ client }) => {
  const controller = new AbortController();
  const reason = new Error("cancelled");
  const image = createImage(2000, 2000, 1);
  const pixels = image.data.buffer;
  const pending = callWithAbort(client, controller.signal, (remote) =>
    remote.addPage("1.png", transfer(pixels, [pixels]), 2000, 2000),
  );

  controller.abort(reason);

  await expect(pending).rejects.toBe(reason);
});

test("terminates the worker and leaves no download when export is aborted", async () => {
  const host = document.createElement("div");
  const page = document.createElement("div");
  page.className = "kgv-page";
  page.textContent = "abort";
  host.append(page);
  document.body.append(host);
  const composed = {
    layout: { pages: [{}], geometry: { paperWidthMm: 10, paperHeightMm: 10 } },
  } as unknown as NovelComposedManuscript;
  const typography = { fontFaces: [] } as unknown as ReadyTypography;
  const controller = new AbortController();
  const reason = new Error("cancelled");
  const terminate = vi.spyOn(Worker.prototype, "terminate");
  const originalPostMessage: unknown = Object.getOwnPropertyDescriptor(
    Worker.prototype,
    "postMessage",
  )?.value;
  expect.assert(typeof originalPostMessage === "function");
  // 最初のページを Worker へ送った直後に中断する
  vi.spyOn(Worker.prototype, "postMessage").mockImplementation(function (
    this: Worker,
    ...args: unknown[]
  ) {
    Reflect.apply(originalPostMessage, this, args) as void;
    controller.abort(reason);
  });
  const createObjectURL = vi.spyOn(URL, "createObjectURL");
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click");

  const result = exportPages(host, composed, typography, "novel.txt", controller.signal);

  await expect(result).rejects.toBe(reason);
  expect(terminate).toHaveBeenCalledTimes(1);
  expect(createObjectURL).not.toHaveBeenCalled();
  expect(click).not.toHaveBeenCalled();

  host.remove();
  vi.restoreAllMocks();
});

test("rejects the export with a readable error when the worker stops", async () => {
  const host = document.createElement("div");
  const page = document.createElement("div");
  page.className = "kgv-page";
  page.textContent = "crash";
  host.append(page);
  document.body.append(host);
  const composed = {
    layout: { pages: [{}], geometry: { paperWidthMm: 10, paperHeightMm: 10 } },
  } as unknown as NovelComposedManuscript;
  const typography = { fontFaces: [] } as unknown as ReadyTypography;
  const terminate = vi.spyOn(Worker.prototype, "terminate");
  // 最初のページを送る代わりに、Worker が異常終了したときの error イベントを起こす
  vi.spyOn(Worker.prototype, "postMessage").mockImplementation(function (this: Worker) {
    this.dispatchEvent(new Event("error"));
  });
  const createObjectURL = vi.spyOn(URL, "createObjectURL");
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click");

  const result = exportPages(host, composed, typography, "novel.txt", new AbortController().signal);

  await expect(result).rejects.toThrow("画像を書き出す処理が停止しました");
  expect(terminate).toHaveBeenCalledTimes(1);
  expect(createObjectURL).not.toHaveBeenCalled();
  expect(click).not.toHaveBeenCalled();

  host.remove();
  vi.restoreAllMocks();
});
