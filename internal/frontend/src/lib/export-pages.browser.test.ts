import { unzlibSync } from "fflate";
import { expect, test } from "vite-plus/test";

import { monochromePng } from "./export-pages";

test("encodes a 600 dpi one-bit grayscale PNG", () => {
  const image = new ImageData(3, 1);
  image.data.set([0, 0, 0, 255, 255, 255, 255, 255, 120, 120, 120, 255]);

  const png = monochromePng(image);

  expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  expect(view.getUint32(16)).toBe(3);
  expect(view.getUint32(20)).toBe(1);
  expect(png[24]).toBe(1);
  expect(png[25]).toBe(0);
  expect(new TextDecoder().decode(png.subarray(37, 41))).toBe("pHYs");
  expect(view.getUint32(41)).toBe(Math.round(600 / 0.0254));
  expect(view.getUint32(45)).toBe(Math.round(600 / 0.0254));
  const compressedSize = view.getUint32(54);
  expect(new TextDecoder().decode(png.subarray(58, 62))).toBe("IDAT");
  expect(Array.from(unzlibSync(png.subarray(62, 62 + compressedSize)))).toEqual([0, 0b01000000]);
});
