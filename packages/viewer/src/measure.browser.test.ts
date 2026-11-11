import { expect, test } from "vite-plus/test";

import { loadFontMeasurer } from "./measure";
import { oracleRows } from "./measure-oracle";

test("matches the uharfbuzz oracle in the browser without touching the document", async () => {
  const fonts = document.fonts.size;
  const elements = document.body.querySelectorAll("*").length;

  const [mincho, genei] = await Promise.all([
    loadFontMeasurer({ fontPreset: "mincho" }),
    loadFontMeasurer({ fontPreset: "genei-koburi" }),
  ]);
  expect.assert(mincho.ok && genei.ok);
  const rows = oracleRows({ mincho: mincho.value.measurer, "genei-koburi": genei.value.measurer });

  expect(rows.length).toBeGreaterThan(600);
  expect(rows.filter(({ expected, actual }) => expected !== actual)).toEqual([]);
  expect(document.fonts.size).toBe(fonts);
  expect(document.body.querySelectorAll("*")).toHaveLength(elements);
});

test("reports a font that cannot be fetched", async () => {
  const loaded = await loadFontMeasurer({
    fontPreset: "genei-koburi",
    fontUrls: { 400: "http://127.0.0.1:1/unreachable.ttf" },
  });

  expect(loaded).toEqual({ ok: false, error: { kind: "font-load" } });
});

test("rejects fetched bytes that differ from the bundled font", async () => {
  const loaded = await loadFontMeasurer({
    fontPreset: "genei-koburi",
    fontUrls: { 400: "data:application/octet-stream;base64,YWJj" },
  });

  expect(loaded).toEqual({ ok: false, error: { kind: "font-integrity" } });
});
