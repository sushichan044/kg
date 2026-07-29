import { DEFAULT_APPEARANCE, DEFAULT_SETTINGS, DEFAULT_ZOOM } from "@sushichan044/kg-core";
// Runs in the browser project for a real localStorage. Imports the runner from
// "vitest" directly; the "vite-plus/test" re-export does not resolve it.
// oxlint-disable-next-line vite-plus/prefer-vite-plus-imports
import { beforeEach, expect, test } from "vitest";

import { loadState, saveState } from "./storage";
import type { ViewerState } from "./storage";

const STORAGE_KEY = "kg.viewer.state.v2";
const LEGACY_STORAGE_KEY = "kg.viewer.state.v1";

beforeEach(() => {
  localStorage.clear();
});

test("returns defaults when nothing is stored", () => {
  const state = loadState();
  expect(state.settings).toEqual(DEFAULT_SETTINGS);
  expect(state.appearance).toEqual(DEFAULT_APPEARANCE);
  expect(state.zoom).toEqual(DEFAULT_ZOOM);
  expect(state.presets).toEqual([]);
  expect(state.selectedPath).toBeNull();
});

test("round-trips settings, selection, and presets", () => {
  const state: ViewerState = {
    selectedPath: "a.txt",
    settings: { charsPerLine: 20, linesPerStage: 30, stagesPerPage: 1 },
    appearance: { paperSize: "jis-b6", marginMm: 15, fontPreset: "gothic" },
    zoom: { mode: "fit" },
    presets: [
      {
        name: "縦長",
        settings: DEFAULT_SETTINGS,
        appearance: DEFAULT_APPEARANCE,
      },
    ],
  };

  expect(saveState(state)).toBe(true);
  expect(loadState()).toEqual(state);
});

test("migrates version 1 settings and presets with appearance defaults", () => {
  localStorage.setItem(
    LEGACY_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      selectedPath: "old.txt",
      settings: { charsPerLine: 20, linesPerStage: 30, stagesPerPage: 1 },
      presets: [{ name: "旧設定", settings: DEFAULT_SETTINGS }],
    }),
  );

  expect(loadState()).toEqual({
    selectedPath: "old.txt",
    settings: { charsPerLine: 20, linesPerStage: 30, stagesPerPage: 1 },
    appearance: DEFAULT_APPEARANCE,
    zoom: DEFAULT_ZOOM,
    presets: [
      {
        name: "旧設定",
        settings: DEFAULT_SETTINGS,
        appearance: DEFAULT_APPEARANCE,
      },
    ],
  });
});

test("preserves valid version 2 data when appearance values are invalid", () => {
  const settings = { charsPerLine: 20, linesPerStage: 30, stagesPerPage: 1 };
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 2,
      selectedPath: "current.txt",
      settings,
      appearance: { paperSize: "letter", marginMm: 20, fontPreset: "mincho" },
      zoom: { mode: "fixed", percent: 90 },
      presets: [
        {
          name: "旧外観",
          settings: DEFAULT_SETTINGS,
          appearance: { paperSize: "a5", marginMm: 12, fontPreset: "mincho" },
        },
      ],
    }),
  );

  expect(loadState()).toEqual({
    selectedPath: "current.txt",
    settings,
    appearance: DEFAULT_APPEARANCE,
    zoom: DEFAULT_ZOOM,
    presets: [
      {
        name: "旧外観",
        settings: DEFAULT_SETTINGS,
        appearance: DEFAULT_APPEARANCE,
      },
    ],
  });
});

test("prefers valid version 2 data over legacy data", () => {
  localStorage.setItem(
    LEGACY_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      selectedPath: "legacy.txt",
      settings: DEFAULT_SETTINGS,
      presets: [],
    }),
  );
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 2,
      selectedPath: "current.txt",
      settings: DEFAULT_SETTINGS,
      appearance: DEFAULT_APPEARANCE,
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
      version: 2,
      settings: { charsPerLine: 999, linesPerStage: 23, stagesPerPage: 2 },
    }),
  ],
])("falls back to legacy data when version 2 contains %s", (_caseName, currentValue) => {
  localStorage.setItem(
    LEGACY_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      selectedPath: "legacy.txt",
      settings: DEFAULT_SETTINGS,
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
      zoom: DEFAULT_ZOOM,
    }),
  );

  expect(loadState()).toEqual({
    selectedPath: null,
    settings: DEFAULT_SETTINGS,
    appearance: DEFAULT_APPEARANCE,
    zoom: DEFAULT_ZOOM,
    presets: [],
  });
});

test("discards out-of-range settings", () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 2,
      settings: { charsPerLine: 999, linesPerStage: 23, stagesPerPage: 2 },
      appearance: DEFAULT_APPEARANCE,
      zoom: DEFAULT_ZOOM,
    }),
  );

  expect(loadState().settings).toEqual(DEFAULT_SETTINGS);
});
