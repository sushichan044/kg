import type { NovelComposedManuscript } from "@sushichan044/kg-core";
import { connectApi, onAbort, transfer } from "@sushichan044/kg-worker-rpc";
import { snapdom } from "@zumer/snapdom";

import type { ReadyTypography } from "../typography";
import type { PageEncoderApi } from "./protocol";

const DPI = 600;

/**
 * `definePageEncoderWorker` を呼んだ Worker。
 */
export type PageEncoderWorkerEndpoint = Worker | MessagePort;

export type ExportPagesOptions = Readonly<{
  /**
   * `NovelViewer` を描画済みの要素。中の `.kgv-page` をページ順に画像にする。
   */
  host: HTMLElement;
  composed: NovelComposedManuscript;
  typography: ReadyTypography;
  /**
   * エンコード用の Worker を作る。書き出しのたびに 1 つ作り、終わるか abort されると止める。
   */
  createWorker: () => PageEncoderWorkerEndpoint;
  /**
   * Abort されると Worker を止め、返り値の Promise は reject される。
   */
  signal: AbortSignal;
}>;

/**
 * 描画済みの全ページを 600 dpi の 1 ビット白黒 PNG にして、無圧縮の zip のバイト列で返す。
 * ページの描画はメインスレッドで行い、PNG のエンコードと zip の梱包は Worker で行う。
 */
export async function exportPages({
  host,
  composed,
  typography,
  createWorker,
  signal,
}: ExportPagesOptions): Promise<Uint8Array<ArrayBuffer>> {
  signal.throwIfAborted();
  using connection = connectApi<PageEncoderApi>(createWorker());
  let interrupt: (reason: unknown) => void = () => {};
  const interrupted = new Promise<never>((_resolve, reject) => {
    interrupt = reject;
  });
  using _abortWatcher = onAbort(signal, () => {
    connection.close();
    interrupt(signal.reason);
  });
  return ownedBytes(
    await Promise.race([
      render({ host, composed, typography, signal, encoder: connection.api }),
      interrupted,
    ]),
  );
}

// Blob に渡せるよう、SharedArrayBuffer ではなく ArrayBuffer を裏に持つ型にする。コピーは SharedArrayBuffer のときだけ。
function ownedBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return bytes.buffer instanceof ArrayBuffer
    ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    : new Uint8Array(bytes);
}

type RenderOptions = Readonly<{
  host: HTMLElement;
  composed: NovelComposedManuscript;
  typography: ReadyTypography;
  signal: AbortSignal;
  encoder: Pick<PageEncoderApiRemote, "encodePage" | "zip">;
}>;

type PageEncoderApiRemote = ReturnType<typeof connectApi<PageEncoderApi>>["api"];

async function render({
  host,
  composed,
  typography,
  signal,
  encoder,
}: RenderOptions): Promise<Uint8Array> {
  await document.fonts.ready;
  signal.throwIfAborted();
  const pages = Array.from(host.querySelectorAll<HTMLElement>(".kgv-page"));
  if (pages.length !== composed.layout.pages.length)
    throw new Error("ページを準備できませんでした");
  const files: Record<string, Uint8Array> = {};
  const digits = Math.max(3, String(pages.length).length);
  const { paperWidthMm, paperHeightMm } = composed.layout.geometry;
  const width = Math.round((paperWidthMm * DPI) / 25.4);
  const height = Math.round((paperHeightMm * DPI) / 25.4);
  // エンコード中のページは 1 つだけにして、次のページの描画と重ねる。ピクセルの置き場所が増えすぎないようにする。
  let encoding: Promise<void> = Promise.resolve();
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
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
    // eslint-disable-next-line no-await-in-loop
    await encoding;
    const name = `${String(index + 1).padStart(digits, "0")}.png`;
    encoding = encoder.encodePage(transfer({ width, height, data }, [data.buffer])).then((png) => {
      files[name] = png;
    });
  }
  await encoding;
  signal.throwIfAborted();
  return encoder.zip(
    transfer(
      files,
      Object.values(files).map(({ buffer }) => buffer),
    ),
  );
}
