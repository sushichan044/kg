// Runs in the browser project for a real localStorage. Imports the runner from
// "vitest" directly; the "vite-plus/test" re-export does not resolve it.
// oxlint-disable-next-line vite-plus/prefer-vite-plus-imports
import { beforeEach, expect, test } from "vitest";

import { DEFAULT_SETTINGS } from "./pagination";
import { loadState, saveState } from "./storage";
import type { ViewerState } from "./storage";

const STORAGE_KEY = "kg.viewer.state.v1";

beforeEach(() => {
  localStorage.clear();
});

test("returns defaults when nothing is stored", () => {
  const state = loadState();
  expect(state.settings).toEqual(DEFAULT_SETTINGS);
  expect(state.presets).toEqual([]);
  expect(state.selectedPath).toBeNull();
});

test("round-trips settings, selection, and presets", () => {
  const state: ViewerState = {
    selectedPath: "a.txt",
    settings: { charsPerLine: 20, linesPerStage: 30, stagesPerPage: 1 },
    presets: [{ name: "縦長", settings: DEFAULT_SETTINGS }],
  };

  expect(saveState(state)).toBe(true);
  expect(loadState()).toEqual(state);
});

test("discards an incompatible version and falls back to defaults", () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 999, selectedPath: "x.txt", settings: DEFAULT_SETTINGS }),
  );

  expect(loadState()).toEqual({ selectedPath: null, settings: DEFAULT_SETTINGS, presets: [] });
});

test("discards out-of-range settings", () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      settings: { charsPerLine: 999, linesPerStage: 23, stagesPerPage: 2 },
    }),
  );

  expect(loadState().settings).toEqual(DEFAULT_SETTINGS);
});
