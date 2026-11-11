import { connectApi, transfer } from "@sushichan044/kg-worker-rpc";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, test } from "vite-plus/test";

import { monochromePng } from "./png";
import type { PageEncoderApi } from "./protocol";
import { definePageEncoderWorker } from "./worker";

const withEncoder = test.extend<{ encoder: ReturnType<typeof connectApi<PageEncoderApi>>["api"] }>({
  encoder: async ({}, use) => {
    const { port1, port2 } = new MessageChannel();
    definePageEncoderWorker(port1);
    const connection = connectApi<PageEncoderApi>(port2);
    await use(connection.api);
    connection.close();
    port1.close();
  },
});

function image() {
  return {
    width: 3,
    height: 1,
    data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 120, 120, 120, 255]),
  };
}

describe("page encoder worker", () => {
  withEncoder("encodes a page into the same PNG as encoding in place", async ({ encoder }) => {
    // Arrange
    const expected = monochromePng(image());

    // Act
    const png = await encoder.encodePage(image());

    // Assert
    expect(png).toEqual(expected);
  });

  withEncoder("takes ownership of the transferred pixels", async ({ encoder }) => {
    // Arrange
    const raster = image();

    // Act
    await encoder.encodePage(transfer(raster, [raster.data.buffer]));

    // Assert
    expect(raster.data.byteLength).toBe(0);
  });

  withEncoder("packs files into an uncompressed zip", async ({ encoder }) => {
    // Arrange
    const files = { "001.png": new Uint8Array([1, 2, 3]), "002.png": new Uint8Array([4]) };

    // Act
    const zip = await encoder.zip(files);

    // Assert
    const entries = unzipSync(zip);
    expect(Object.keys(entries)).toEqual(["001.png", "002.png"]);
    expect(Array.from(entries["001.png"] ?? [])).toEqual([1, 2, 3]);
    expect(strFromU8(new Uint8Array(zip.subarray(0, 2)))).toBe("PK");
  });
});
