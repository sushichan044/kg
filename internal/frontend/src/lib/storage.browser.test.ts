import { expect, test as base } from "vite-plus/test";

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

const test = base.extend<{ clearedStorage: undefined }>({
  clearedStorage: [
    async ({}, use) => {
      localStorage.clear();
      sessionStorage.clear();

      await use(undefined);
    },
    { auto: true },
  ],
});

test("returns defaults when current state is absent", () => {
  expect(loadAppState()).toEqual(DEFAULT_APP_STATE);
  expect(loadManuscriptPreferences()).toEqual(DEFAULT_MANUSCRIPT_PREFERENCES);
});

test("stores frontend-owned notation, composition, zoom, and presets", () => {
  const preferences = {
    ...DEFAULT_MANUSCRIPT_PREFERENCES,
    composition: {
      ...DEFAULT_MANUSCRIPT_PREFERENCES.composition,
      grid: { ...DEFAULT_MANUSCRIPT_PREFERENCES.composition.grid, charsPerLine: 30 },
    },
    zoom: 125,
    fit: true,
    notation: "kakuyomu" as const,
  };

  expect(saveAppState({ version: 1, selectedPath: "draft.txt" })).toBe(true);
  expect(saveManuscriptPreferences(preferences)).toBe(true);

  expect(loadAppState().selectedPath).toBe("draft.txt");
  expect(loadManuscriptPreferences().composition.grid.charsPerLine).toBe(30);
  expect(loadManuscriptPreferences().zoom).toBe(125);
  expect(loadManuscriptPreferences().fit).toBe(true);
  expect(loadManuscriptPreferences().notation).toBe("kakuyomu");
});

test("does not parse v2 manuscript preferences", () => {
  localStorage.setItem(
    "kg.manuscript.preferences.v2",
    JSON.stringify({ version: 2, settings: { charsPerLine: 30 } }),
  );

  expect(loadManuscriptPreferences()).toEqual(DEFAULT_MANUSCRIPT_PREFERENCES);
});

test("migrates v3 fixed and fit zoom preferences", () => {
  const fixed = {
    version: 3,
    composition: DEFAULT_MANUSCRIPT_PREFERENCES.composition,
    zoom: { kind: "fixed", percent: 125 },
    presets: [],
  };
  localStorage.setItem("kg.manuscript.preferences.v3", JSON.stringify(fixed));

  expect(loadManuscriptPreferences()).toMatchObject({
    version: 5,
    notation: "pixiv",
    zoom: 125,
    fit: false,
  });

  localStorage.setItem(
    "kg.manuscript.preferences.v3",
    JSON.stringify({ ...fixed, zoom: { kind: "fit" } }),
  );

  expect(loadManuscriptPreferences()).toMatchObject({
    version: 5,
    notation: "pixiv",
    zoom: 100,
    fit: true,
  });
});

test("migrates v4 preferences with the existing Pixiv behavior", () => {
  localStorage.setItem(
    "kg.manuscript.preferences.v4",
    JSON.stringify({
      version: 4,
      composition: DEFAULT_MANUSCRIPT_PREFERENCES.composition,
      zoom: 100,
      fit: false,
      presets: [],
    }),
  );

  expect(loadManuscriptPreferences()).toMatchObject({ version: 5, notation: "pixiv" });
});

test("rejects malformed or incomplete v5 payloads", () => {
  localStorage.setItem("kg.app.state.v1", "{");
  localStorage.setItem("kg.manuscript.preferences.v5", JSON.stringify({ version: 5 }));

  expect(loadAppState()).toEqual(DEFAULT_APP_STATE);
  expect(loadManuscriptPreferences()).toEqual(DEFAULT_MANUSCRIPT_PREFERENCES);
});

test("rejects v5 composition settings that violate cross-field offset constraints", () => {
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
  localStorage.setItem("kg.manuscript.preferences.v5", JSON.stringify(invalid));

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
