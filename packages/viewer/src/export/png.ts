import { strToU8, zlibSync } from "fflate";

/**
 * `ImageData` と同じ形の生のピクセル。`ImageData` は Worker で使えない環境があるので、構造だけを受け取る。
 */
export type RasterImage = Readonly<{
  width: number;
  height: number;
  /**
   * 1 ピクセル 4 バイトの RGBA
   */
  data: Uint8ClampedArray;
}>;

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

/**
 * RGBA の画像を、600 dpi の 1 ビット白黒 PNG にする。
 */
export function monochromePng(image: RasterImage): Uint8Array {
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
