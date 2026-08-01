import {
  DEFAULT_APPEARANCE,
  DEFAULT_OFFSETS,
  DEFAULT_SETTINGS,
  DEFAULT_ZOOM,
} from "@sushichan044/kg-core";
import { beforeEach, expect, test } from "vite-plus/test";

import { loadState, saveState } from "./storage";
import type { ViewerState } from "./storage";

const STORAGE_KEY = "kg.viewer.state.v3";
const V2_STORAGE_KEY = "kg.viewer.state.v2";

beforeEach(() => {
  localStorage.clear();
});

test("returns defaults when nothing is stored", () => {
  const state = loadState();
  expect(state.settings).toEqual(DEFAULT_SETTINGS);
  expect(state.appearance).toEqual(DEFAULT_APPEARANCE);
  expect(state.offsets).toEqual(DEFAULT_OFFSETS);
  expect(state.zoom).toEqual(DEFAULT_ZOOM);
  expect(state.presets).toEqual([]);
  expect(state.selectedPath).toBeNull();
});

test("round-trips settings, selection, offsets, and presets", () => {
  const state: ViewerState = {
    selectedPath: "a.txt",
    settings: { charsPerLine: 20, linesPerStage: 30, stagesPerPage: 1 },
    appearance: { paperSize: "jis-b6", fontSizePt: 10.5, fontPreset: "gothic" },
    offsets: {
      document: { leading: 4, trailing: 0 },
      page: { leading: 1, trailing: 1 },
      stage: { leading: 0, trailing: 2 },
    },
    zoom: { mode: "fit" },
    presets: [
      {
        name: "縦長",
        settings: DEFAULT_SETTINGS,
        appearance: DEFAULT_APPEARANCE,
        offsets: DEFAULT_OFFSETS,
      },
    ],
  };

  expect(saveState(state)).toBe(true);
  expect(loadState()).toEqual(state);
});

test("migrates version 2 settings, paper size, and font preset while defaulting fontSizePt and offsets", () => {
  localStorage.setItem(
    V2_STORAGE_KEY,
    JSON.stringify({
      version: 2,
      selectedPath: "old.txt",
      settings: { charsPerLine: 20, linesPerStage: 30, stagesPerPage: 1 },
      appearance: { paperSize: "jis-b6", marginMm: 15, fontPreset: "gothic" },
      presets: [
        {
          name: "旧設定",
          settings: DEFAULT_SETTINGS,
          appearance: { paperSize: "a5", marginMm: 12, fontPreset: "mincho" },
        },
      ],
    }),
  );

  expect(loadState()).toEqual({
    selectedPath: "old.txt",
    settings: { charsPerLine: 20, linesPerStage: 30, stagesPerPage: 1 },
    appearance: {
      paperSize: "jis-b6",
      fontSizePt: DEFAULT_APPEARANCE.fontSizePt,
      fontPreset: "gothic",
    },
    offsets: DEFAULT_OFFSETS,
    zoom: DEFAULT_ZOOM,
    presets: [
      {
        name: "旧設定",
        settings: DEFAULT_SETTINGS,
        appearance: {
          paperSize: "a5",
          fontSizePt: DEFAULT_APPEARANCE.fontSizePt,
          fontPreset: "mincho",
        },
        offsets: DEFAULT_OFFSETS,
      },
    ],
  });
});

test("preserves valid version 3 data when appearance values are invalid", () => {
  const settings = { charsPerLine: 20, linesPerStage: 30, stagesPerPage: 1 };
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 3,
      selectedPath: "current.txt",
      settings,
      appearance: { paperSize: "letter", fontSizePt: 9, fontPreset: "mincho" },
      offsets: DEFAULT_OFFSETS,
      zoom: { mode: "fixed", percent: 90 },
      presets: [
        {
          name: "旧外観",
          settings: DEFAULT_SETTINGS,
          appearance: { paperSize: "a5", fontSizePt: 999, fontPreset: "mincho" },
          offsets: DEFAULT_OFFSETS,
        },
      ],
    }),
  );

  expect(loadState()).toEqual({
    selectedPath: "current.txt",
    settings,
    appearance: DEFAULT_APPEARANCE,
    offsets: DEFAULT_OFFSETS,
    zoom: DEFAULT_ZOOM,
    presets: [
      {
        name: "旧外観",
        settings: DEFAULT_SETTINGS,
        appearance: DEFAULT_APPEARANCE,
        offsets: DEFAULT_OFFSETS,
      },
    ],
  });
});

test("prefers valid version 3 data over version 2 legacy data", () => {
  localStorage.setItem(
    V2_STORAGE_KEY,
    JSON.stringify({
      version: 2,
      selectedPath: "legacy.txt",
      settings: DEFAULT_SETTINGS,
      appearance: { paperSize: "a5", marginMm: 20, fontPreset: "mincho" },
      presets: [],
    }),
  );
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 3,
      selectedPath: "current.txt",
      settings: DEFAULT_SETTINGS,
      appearance: DEFAULT_APPEARANCE,
      offsets: DEFAULT_OFFSETS,
      zoom: DEFAULT_ZOOM,
      presets: [],
    }),
  );

  expect(loadState().selectedPath).toBe("current.txt");
});

test.each([
  ["malformed JSON", "{"],
  [
    "an invalid payload",
    JSON.stringify({
      version: 3,
      settings: { charsPerLine: 999, linesPerStage: 23, stagesPerPage: 2 },
    }),
  ],
])("falls back to version 2 legacy data when version 3 contains %s", (_caseName, currentValue) => {
  localStorage.setItem(
    V2_STORAGE_KEY,
    JSON.stringify({
      version: 2,
      selectedPath: "legacy.txt",
      settings: DEFAULT_SETTINGS,
      appearance: DEFAULT_APPEARANCE,
      presets: [],
    }),
  );
  localStorage.setItem(STORAGE_KEY, currentValue);

  expect(loadState().selectedPath).toBe("legacy.txt");
});

test("discards an incompatible version and falls back to defaults", () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 999,
      selectedPath: "x.txt",
      settings: DEFAULT_SETTINGS,
      appearance: DEFAULT_APPEARANCE,
      offsets: DEFAULT_OFFSETS,
      zoom: DEFAULT_ZOOM,
    }),
  );

  expect(loadState()).toEqual({
    selectedPath: null,
    settings: DEFAULT_SETTINGS,
    appearance: DEFAULT_APPEARANCE,
    offsets: DEFAULT_OFFSETS,
    zoom: DEFAULT_ZOOM,
    presets: [],
  });
});

test("discards out-of-range settings", () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 3,
      settings: { charsPerLine: 999, linesPerStage: 23, stagesPerPage: 2 },
      appearance: DEFAULT_APPEARANCE,
      offsets: DEFAULT_OFFSETS,
      zoom: DEFAULT_ZOOM,
    }),
  );

  expect(loadState().settings).toEqual(DEFAULT_SETTINGS);
});

test("discards invalid offsets and falls back to defaults", () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 3,
      settings: DEFAULT_SETTINGS,
      appearance: DEFAULT_APPEARANCE,
      offsets: {
        document: { leading: -1, trailing: 0 },
        page: { leading: 0, trailing: 0 },
        stage: { leading: 0, trailing: 0 },
      },
      zoom: DEFAULT_ZOOM,
    }),
  );

  expect(loadState().offsets).toEqual(DEFAULT_OFFSETS);
});
