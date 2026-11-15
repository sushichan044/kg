import type { NovelComposedManuscript } from "@sushichan044/kg-core";
import type { ReadyTypography } from "@sushichan044/kg-viewer";
import { snapdom } from "@zumer/snapdom";
import { callWithAbort, connectWorker, transfer } from "kg-worker-rpc";

import type { Api } from "./export-encoder.worker";

export async function exportPages(
  host: HTMLElement,
  composed: NovelComposedManuscript,
  typography: ReadyTypography,
  filename: string,
  signal: AbortSignal,
): Promise<void> {
  await document.fonts.ready;
  signal.throwIfAborted();
  const pages = Array.from(host.querySelectorAll<HTMLElement>(".kgv-page"));
  if (pages.length !== composed.layout.pages.length)
    throw new Error("ページを準備できませんでした");
  const digits = Math.max(3, String(pages.length).length);
  const { paperWidthMm, paperHeightMm } = composed.layout.geometry;
  const width = Math.round((paperWidthMm * 600) / 25.4);
  const height = Math.round((paperHeightMm * 600) / 25.4);
  // 終了時（成功・失敗・中断）に必ず Worker を止める
  using client = connectWorker<Api>(
    new Worker(new URL("./export-encoder.worker.ts", import.meta.url), { type: "module" }),
  );
  for (const [index, page] of pages.entries()) {
    signal.throwIfAborted();
    page.style.contentVisibility = "visible";
    page.style.boxShadow = "none";
    // 1 ページずつ描画すると、600 dpi で必要になるキャンバスのメモリを抑えられる。
    // eslint-disable-next-line no-await-in-loop
    const canvas = await snapdom.toCanvas(page, {
      width,
      height,
      dpr: 1,
      backgroundColor: "#ffffff",
      embedFonts: true,
      localFonts: typography.fontFaces.map((face) => ({ ...face })),
    });
    signal.throwIfAborted();
    if (canvas.width !== width || canvas.height !== height)
      throw new Error("このブラウザでは必要な解像度の画像を生成できませんでした");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("画像を生成できませんでした");
    const { data } = context.getImageData(0, 0, width, height);
    canvas.width = 0;
    canvas.height = 0;
    const name = `${String(index + 1).padStart(digits, "0")}.png`;
    const pixels = data.buffer;
    // ピクセルは transfer で渡す（コピーなし）。送った側の ArrayBuffer は detach される。
    // eslint-disable-next-line no-await-in-loop
    await callWithAbort(client, signal, (remote) =>
      remote.addPage(name, transfer(pixels, [pixels]), width, height),
    );
  }
  const bytes = await callWithAbort(client, signal, (remote) => remote.zip());
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename.replace(/\.[^.]+$/, "")}.zip`;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}
