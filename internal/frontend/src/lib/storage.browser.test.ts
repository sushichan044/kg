import { DEFAULT_SETTINGS, createManuscript } from "@sushichan044/kg-core";
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

test("stores app state separately from manuscript preferences", () => {
  const manuscript = createManuscript({
    settings: { ...DEFAULT_SETTINGS, charsPerLine: 30 },
    zoom: { mode: "fit" },
  });

  expect(saveAppState({ version: 1, selectedPath: "draft.txt" })).toBe(true);
  expect(saveManuscriptPreferences(manuscript.state)).toBe(true);

  expect(loadAppState().selectedPath).toBe("draft.txt");
  expect(loadManuscriptPreferences().settings.charsPerLine).toBe(30);
  expect(loadManuscriptPreferences().zoom).toEqual({ mode: "fit" });
});

test("does not parse legacy viewer state", () => {
  localStorage.setItem(
    "kg.viewer.state.v3",
    JSON.stringify({ version: 3, selectedPath: "legacy.txt", settings: DEFAULT_SETTINGS }),
  );

  expect(loadAppState()).toEqual(DEFAULT_APP_STATE);
  expect(loadManuscriptPreferences()).toEqual(DEFAULT_MANUSCRIPT_PREFERENCES);
});

test("rejects malformed or incomplete current payloads", () => {
  localStorage.setItem("kg.app.state.v1", "{");
  localStorage.setItem(
    "kg.manuscript.preferences.v1",
    JSON.stringify({ version: 1, settings: DEFAULT_SETTINGS }),
  );

  expect(loadAppState()).toEqual(DEFAULT_APP_STATE);
  expect(loadManuscriptPreferences()).toEqual(DEFAULT_MANUSCRIPT_PREFERENCES);
});

test("round-trips the visible page per document for the current session", () => {
  savePage("draft.txt", 3);
  expect(loadPage("draft.txt")).toBe(3);
  expect(loadPage("other.txt")).toBe(0);
});
