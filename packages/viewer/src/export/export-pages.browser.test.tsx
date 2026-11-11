import {
  composeManuscript,
  FontPreset,
  NovelCompositionSettings,
  novelComposer,
  parseManuscript,
} from "@sushichan044/kg-core";
import type { NovelComposedManuscript } from "@sushichan044/kg-core";
import { logicalRunMeasurer } from "@sushichan044/kg-core/plugin";
import { unzipSync } from "fflate";
import { expect, test as base, vi } from "vite-plus/test";
import { server } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { NovelViewer } from "../NovelViewer";
import type { ReadyTypography } from "../typography";
import { exportPages } from "./index";

import "../styles.css";

// snapdom が必要な解像度の画像を作れるかはブラウザー次第なので、書き出しの実測は Chromium だけで行う
const chromiumOnly = server.browser === "chromium";

function createWorker() {
  return new Worker(new URL("./test-encoder.worker.ts", import.meta.url), { type: "module" });
}

type Fixture = Readonly<{
  composed: NovelComposedManuscript;
  typography: ReadyTypography;
  host: HTMLElement;
}>;

const test = base.extend<{ fixture: Fixture }>({
  fixture: async ({}, use) => {
    const parsed = parseManuscript("あ".repeat(3000));
    expect.assert(parsed.ok, "fixture did not parse");
    const composed = composeManuscript(parsed.value, {
      composer: novelComposer,
      settings: NovelCompositionSettings.forPaper("a5", {
        page: NovelCompositionSettings.defaults.page,
        flow: { lineLengthEm: 10, linesPerStage: 10, stagesPerPage: 1 },
        offsets: NovelCompositionSettings.defaults.offsets,
        appearance: NovelCompositionSettings.defaults.appearance,
      }),
    });
    expect.assert(composed.ok, "fixture did not compose");
    const typography: ReadyTypography = {
      fontFaces: [],
      fontPreset: composed.value.settings.appearance.fontPreset,
      prepare: (manuscript) => ({ parsed: manuscript, mapRange: (range) => range }),
      fontFamily: FontPreset.of(composed.value.settings.appearance.fontPreset).family,
      composer: novelComposer,
      measurer: logicalRunMeasurer,
      dispose: () => {},
    };
    const screen = await render(
      <NovelViewer composed={composed.value} typography={typography} showGrid={false} />,
    );
    await expect
      .poll(() => screen.container.querySelector(".kgv-page") !== null, { timeout: 10000 })
      .toBe(true);

    await use({ composed: composed.value, typography, host: screen.container });
  },
});

test.skipIf(!chromiumOnly)(
  "exports every page as a monochrome PNG in a zip built in a worker",
  { timeout: 60000 },
  async ({ fixture }) => {
    // Arrange
    const { composed, typography, host } = fixture;

    // Act
    const zip = await exportPages({
      host,
      composed,
      typography,
      createWorker,
      signal: new AbortController().signal,
    });

    // Assert
    const entries = unzipSync(zip);
    expect(Object.keys(entries)).toEqual(
      composed.layout.pages.map((_page, index) => `${String(index + 1).padStart(3, "0")}.png`),
    );
    expect(composed.layout.pages.length).toBeGreaterThan(1);
    for (const png of Object.values(entries)) {
      expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
      const { paperWidthMm, paperHeightMm } = composed.layout.geometry;
      expect(view.getUint32(16)).toBe(Math.round((paperWidthMm * 600) / 25.4));
      expect(view.getUint32(20)).toBe(Math.round((paperHeightMm * 600) / 25.4));
    }
  },
);

test.skipIf(!chromiumOnly)(
  "stops the worker and rejects when aborted",
  { timeout: 60000 },
  async ({ fixture }) => {
    // Arrange
    const { composed, typography, host } = fixture;
    const controller = new AbortController();
    const worker = createWorker();
    const terminate = vi.spyOn(worker, "terminate");

    // Act
    const exported = exportPages({
      host,
      composed,
      typography,
      createWorker: () => worker,
      signal: controller.signal,
    });
    controller.abort(new Error("cancelled"));

    // Assert
    await expect(exported).rejects.toThrow("cancelled");
    expect(terminate).toHaveBeenCalled();
  },
);

test("rejects without creating a worker when already aborted", async ({ fixture }) => {
  // Arrange
  const { composed, typography, host } = fixture;
  const controller = new AbortController();
  controller.abort(new Error("stale"));
  const create = vi.fn<typeof createWorker>(createWorker);

  // Act
  const exported = exportPages({
    host,
    composed,
    typography,
    createWorker: create,
    signal: controller.signal,
  });

  // Assert
  await expect(exported).rejects.toThrow("stale");
  expect(create).not.toHaveBeenCalled();
});
