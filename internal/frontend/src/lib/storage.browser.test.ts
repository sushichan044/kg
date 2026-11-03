import { NovelCompositionSettings } from "@sushichan044/kg-core";
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

test("stores frontend-owned notation, composition, grid visibility, and zoom", () => {
  const preferences = {
    ...DEFAULT_MANUSCRIPT_PREFERENCES,
    composition: NovelCompositionSettings.forPaper("a4", {
      ...DEFAULT_MANUSCRIPT_PREFERENCES.composition,
      flow: { ...DEFAULT_MANUSCRIPT_PREFERENCES.composition.flow, lineLengthEm: 30 },
    }),
    showGrid: false,
    spread: true,
    startPageSide: "left" as const,
    zoom: 125,
    fit: true,
    notation: "kakuyomu" as const,
  };

  expect(saveAppState({ version: 1, selectedPath: "draft.txt" })).toBe(true);
  expect(saveManuscriptPreferences(preferences)).toBe(true);

  expect(loadAppState().selectedPath).toBe("draft.txt");
  expect(loadManuscriptPreferences().composition.flow.lineLengthEm).toBe(30);
  expect(loadManuscriptPreferences().showGrid).toBe(false);
  expect(loadManuscriptPreferences().spread).toBe(true);
  expect(loadManuscriptPreferences().startPageSide).toBe("left");
  expect(loadManuscriptPreferences().zoom).toBe(125);
  expect(loadManuscriptPreferences().fit).toBe(true);
  expect(loadManuscriptPreferences().notation).toBe("kakuyomu");
});

test("ignores all previous preference versions", () => {
  for (const version of [2, 3, 4, 5, 6]) {
    localStorage.setItem(
      `kg.manuscript.preferences.v${version}`,
      JSON.stringify({
        ...DEFAULT_MANUSCRIPT_PREFERENCES,
        version,
        zoom: 125,
      }),
    );
  }

  expect(loadManuscriptPreferences()).toEqual(DEFAULT_MANUSCRIPT_PREFERENCES);
});

test("uses defaults for malformed current settings", () => {
  localStorage.setItem("kg.app.state.v1", "{");
  localStorage.setItem("kg.manuscript.preferences.v7", JSON.stringify({ version: 7 }));

  expect(loadAppState()).toEqual(DEFAULT_APP_STATE);
  expect(loadManuscriptPreferences()).toEqual(DEFAULT_MANUSCRIPT_PREFERENCES);
});

test("refuses to save inconsistent physical dimensions", () => {
  const invalid = {
    ...DEFAULT_MANUSCRIPT_PREFERENCES,
    composition: {
      ...DEFAULT_MANUSCRIPT_PREFERENCES.composition,
      page: { ...DEFAULT_MANUSCRIPT_PREFERENCES.composition.page, bottomMm: 20 },
    },
  };

  expect(saveManuscriptPreferences(invalid)).toBe(false);
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

test("restores existing preferences with defaults for missing spread settings", () => {
  localStorage.setItem(
    "kg.manuscript.preferences.v7",
    JSON.stringify({
      version: 7,
      notation: "kakuyomu",
      composition: DEFAULT_MANUSCRIPT_PREFERENCES.composition,
      showGrid: false,
      zoom: 125,
      fit: true,
      presets: [],
    }),
  );

  expect(loadManuscriptPreferences()).toEqual({
    ...DEFAULT_MANUSCRIPT_PREFERENCES,
    notation: "kakuyomu",
    showGrid: false,
    zoom: 125,
    fit: true,
    spread: false,
    startPageSide: "right",
  });
});

for (const invalid of [{ spread: "true" }, { startPageSide: "center" }]) {
  test(`rejects invalid spread preferences ${JSON.stringify(invalid)}`, () => {
    localStorage.setItem(
      "kg.manuscript.preferences.v7",
      JSON.stringify({
        ...DEFAULT_MANUSCRIPT_PREFERENCES,
        spread: true,
        startPageSide: "left",
        ...invalid,
      }),
    );

    expect(loadManuscriptPreferences()).toEqual(DEFAULT_MANUSCRIPT_PREFERENCES);
  });
}

test("discards named presets while preserving existing display preferences", () => {
  localStorage.setItem(
    "kg.manuscript.preferences.v7",
    JSON.stringify({
      ...DEFAULT_MANUSCRIPT_PREFERENCES,
      zoom: 300,
      notation: "kakuyomu",
      presets: [{ name: "Old preset", composition: DEFAULT_MANUSCRIPT_PREFERENCES.composition }],
    }),
  );

  const preferences = loadManuscriptPreferences();

  expect(preferences.zoom).toBe(300);
  expect(preferences.notation).toBe("kakuyomu");
  expect(preferences).not.toHaveProperty("presets");
  expect(saveManuscriptPreferences(preferences)).toBe(true);
  expect(
    JSON.parse(localStorage.getItem("kg.manuscript.preferences.v7") ?? "null"),
  ).not.toHaveProperty("presets");
});

test("preserves preferences when migrating the former A5 margins", () => {
  localStorage.setItem(
    "kg.manuscript.preferences.v7",
    JSON.stringify({
      ...DEFAULT_MANUSCRIPT_PREFERENCES,
      zoom: 125,
      composition: {
        ...DEFAULT_MANUSCRIPT_PREFERENCES.composition,
        page: { ...DEFAULT_MANUSCRIPT_PREFERENCES.composition.page, topMm: 12, bottomMm: 16.55 },
      },
    }),
  );

  const restored = loadManuscriptPreferences();

  expect(restored.zoom).toBe(125);
  expect(restored.composition.page.topMm).toBe(16.55);
  expect(restored.composition.page.bottomMm).toBe(12);
});
