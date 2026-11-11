import type { NovelComposedManuscript } from "@sushichan044/kg-core";
import type { ReadyTypography } from "@sushichan044/kg-viewer";
import { snapdom } from "@zumer/snapdom";
import { strToU8, zlibSync, zipSync } from "fflate";

function chunk(name: string, data: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length + 12);
  const view = new DataView(result.buffer);
  view.setUint32(0, data.length);
  result.set(strToU8(name), 4);
  result.set(data, 8);
  let crc = 0xffffffff;
  for (const byte of result.subarray(4, data.length + 8)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
  }
  view.setUint32(data.length + 8, (crc ^ 0xffffffff) >>> 0);
  return result;
}

export function monochromePng(image: ImageData): Uint8Array {
  const { width, height, data } = image;
  const rowLength = Math.ceil(width / 8);
  const rows = new Uint8Array((rowLength + 1) * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = (y * width + x) * 4;
      const alpha = (data[source + 3] ?? 0) / 255;
      const brightness =
        ((data[source] ?? 0) * 0.299 +
          (data[source + 1] ?? 0) * 0.587 +
          (data[source + 2] ?? 0) * 0.114) *
          alpha +
        255 * (1 - alpha);
      if (brightness >= 128) rows[y * (rowLength + 1) + 1 + Math.floor(x / 8)]! |= 0x80 >> (x % 8);
    }
  }
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = 1;
  const resolution = new Uint8Array(9);
  const resolutionView = new DataView(resolution.buffer);
  resolutionView.setUint32(0, Math.round(600 / 0.0254));
  resolutionView.setUint32(4, Math.round(600 / 0.0254));
  resolution[8] = 1;
  const pieces = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("pHYs", resolution),
    chunk("IDAT", zlibSync(rows)),
    chunk("IEND", new Uint8Array()),
  ];
  const output = new Uint8Array(pieces.reduce((total, piece) => total + piece.length, 0));
  let offset = 0;
  for (const piece of pieces) {
    output.set(piece, offset);
    offset += piece.length;
  }
  return output;
}

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
  const files: Record<string, Uint8Array> = {};
  const digits = Math.max(3, String(pages.length).length);
  const { paperWidthMm, paperHeightMm } = composed.layout.geometry;
  const width = Math.round((paperWidthMm * 600) / 25.4);
  const height = Math.round((paperHeightMm * 600) / 25.4);
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
    files[`${String(index + 1).padStart(digits, "0")}.png`] = monochromePng(
      context.getImageData(0, 0, canvas.width, canvas.height),
    );
    canvas.width = 0;
    canvas.height = 0;
  }
  signal.throwIfAborted();
  const bytes = zipSync(files, { level: 0 });
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename.replace(/\.[^.]+$/, "")}.zip`;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}
