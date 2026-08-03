import type { ZoomMode } from "@sushichan044/kg-viewer";
import { beforeEach, expect, test } from "vite-plus/test";

import {
  DEFAULT_APP_STATE,
  DEFAULT_MANUSCRIPT_PREFERENCES,
  loadAppState,
  loadManuscriptPreferences,
  loadPage,
  saveAppState,
  saveManuscriptPreferences,
  savePage,
} from "./storage";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

test("returns defaults when current state is absent", () => {
  expect(loadAppState()).toEqual(DEFAULT_APP_STATE);
  expect(loadManuscriptPreferences()).toEqual(DEFAULT_MANUSCRIPT_PREFERENCES);
});

test("stores frontend-owned composition, zoom, and presets", () => {
  const preferences = {
    ...DEFAULT_MANUSCRIPT_PREFERENCES,
    composition: {
      ...DEFAULT_MANUSCRIPT_PREFERENCES.composition,
      grid: { ...DEFAULT_MANUSCRIPT_PREFERENCES.composition.grid, charsPerLine: 30 },
    },
    zoom: { kind: "fit" } as const satisfies ZoomMode,
  };

  expect(saveAppState({ version: 1, selectedPath: "draft.txt" })).toBe(true);
  expect(saveManuscriptPreferences(preferences)).toBe(true);
  expect(loadAppState().selectedPath).toBe("draft.txt");
  expect(loadManuscriptPreferences().composition.grid.charsPerLine).toBe(30);
  expect(loadManuscriptPreferences().zoom).toEqual({ kind: "fit" });
});

test("does not parse v2 manuscript preferences", () => {
  localStorage.setItem(
    "kg.manuscript.preferences.v2",
    JSON.stringify({ version: 2, settings: { charsPerLine: 30 } }),
  );
  expect(loadManuscriptPreferences()).toEqual(DEFAULT_MANUSCRIPT_PREFERENCES);
});

test("rejects malformed or incomplete v3 payloads", () => {
  localStorage.setItem("kg.app.state.v1", "{");
  localStorage.setItem("kg.manuscript.preferences.v3", JSON.stringify({ version: 3 }));
  expect(loadAppState()).toEqual(DEFAULT_APP_STATE);
  expect(loadManuscriptPreferences()).toEqual(DEFAULT_MANUSCRIPT_PREFERENCES);
});

test("rejects v3 composition settings that violate cross-field offset constraints", () => {
  const invalid = {
    ...DEFAULT_MANUSCRIPT_PREFERENCES,
    composition: {
      ...DEFAULT_MANUSCRIPT_PREFERENCES.composition,
      grid: { charsPerLine: 10, linesPerStage: 10, stagesPerPage: 1 },
      offsets: {
        ...DEFAULT_MANUSCRIPT_PREFERENCES.composition.offsets,
        stage: { leading: 5, trailing: 5 },
      },
    },
  };
  localStorage.setItem("kg.manuscript.preferences.v3", JSON.stringify(invalid));

  expect(loadManuscriptPreferences()).toEqual(DEFAULT_MANUSCRIPT_PREFERENCES);
});

test("round-trips the visible page per document for the current session", () => {
  savePage("draft.txt", 3);
  expect(loadPage("draft.txt")).toBe(3);
  expect(loadPage("other.txt")).toBe(0);
});

test("keeps the stored page when asked to save an invalid page index", () => {
  savePage("draft.txt", 3);
  savePage("draft.txt", -1);
  savePage("draft.txt", 1.5);
  expect(loadPage("draft.txt")).toBe(3);
});
