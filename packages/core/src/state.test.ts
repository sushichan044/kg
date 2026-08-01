import { describe, expect, test, vi } from "vite-plus/test";

import { DEFAULT_APPEARANCE, DEFAULT_ZOOM } from "./appearance";
import { DEFAULT_OFFSETS, DEFAULT_SETTINGS } from "./pagination";
import { DEFAULT_PROOFREADING_OPTIONS } from "./proofreading";
import {
  DEFAULT_MANUSCRIPT_PRESET,
  createManuscript,
  createManuscriptState,
  decodeManuscriptPreferences,
  encodeManuscriptPreferences,
} from "./state";
import type {
  DecodeManuscriptPreferencesResult,
  ManuscriptListener,
  ManuscriptPreferences,
} from "./state";

function decodedValue(result: DecodeManuscriptPreferencesResult): ManuscriptPreferences {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected preferences to decode");
  }

  return result.value;
}

describe("ManuscriptState", () => {
  test("derives layout and diagnostics from one immutable snapshot", () => {
    const state = createManuscriptState({ text: "段落\n「誤り。。。 」" });

    expect(state.pagination.stats.sourceLines).toBe(2);
    expect(state.geometry.fontSizePt).toBe(DEFAULT_APPEARANCE.fontSizePt);
    expect(state.diagnostics).not.toHaveLength(0);

    const transaction = state.update(
      { type: "document.replace", text: "　正常" },
      { type: "config.patch", patch: { settings: { charsPerLine: 30 } } },
    );

    expect(transaction.accepted).toBe(true);
    expect(transaction.previousState).toBe(state);
    expect(transaction.state).not.toBe(state);
    expect(transaction.documentChanged).toBe(true);
    expect(transaction.configChanged).toBe(true);
    expect(transaction.state.settings.charsPerLine).toBe(30);
    expect(transaction.state.diagnostics).toHaveLength(0);
    expect(state.text).toBe("段落\n「誤り。。。 」");
    expect(state.settings).toEqual(DEFAULT_SETTINGS);
  });

  test("rejects an invalid batch without applying earlier actions", () => {
    const state = createManuscriptState();
    const transaction = state.update(
      { type: "zoom.set", zoom: { mode: "fit" } },
      { type: "config.patch", patch: { settings: { charsPerLine: 0 } } },
    );

    expect(transaction.accepted).toBe(false);
    expect(transaction.state).toBe(state);
    expect(transaction.issues[0]?.code).toBe("invalid-config");
    expect(state.zoom).toEqual(DEFAULT_ZOOM);
  });

  test("notifies controller subscribers once for a dispatched batch", () => {
    const manuscript = createManuscript();
    const listener = vi.fn<ManuscriptListener>();
    manuscript.subscribe(listener);

    const transaction = manuscript.dispatch(
      { type: "document.replace", text: "　本文" },
      { type: "zoom.set", zoom: { mode: "fit" } },
    );

    expect(transaction.accepted).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(transaction);
    expect(manuscript.state).toBe(transaction.state);
  });

  test("clears a selected diagnostic when the document no longer contains it", () => {
    const initial = createManuscriptState({ text: "段落" });
    const diagnostic = initial.diagnostics[0];
    expect(diagnostic).toBeDefined();

    const selected = initial.update({
      type: "diagnostic.select",
      id: diagnostic?.id ?? null,
    }).state;
    expect(selected.activeDiagnosticId).toBe(diagnostic?.id);

    const replaced = selected.update({ type: "document.replace", text: "　正常" }).state;
    expect(replaced.activeDiagnosticId).toBeNull();
  });

  test("applies and protects built-in and custom presets", () => {
    const initial = createManuscriptState();
    const configured = initial.update({
      type: "config.patch",
      patch: { settings: { charsPerLine: 35 }, appearance: { fontSizePt: 10 } },
    }).state;
    const saved = configured.update({ type: "preset.save", name: "文庫", overwrite: false });

    expect(saved.accepted).toBe(true);
    expect(saved.state.presets[0]?.name).toBe("文庫");
    expect(
      saved.state.update({ type: "preset.save", name: "文庫", overwrite: false }).issues[0]?.code,
    ).toBe("preset-exists");

    const reset = saved.state.update({
      type: "preset.apply",
      name: DEFAULT_MANUSCRIPT_PRESET.name,
    });
    expect(reset.state.settings).toEqual(DEFAULT_SETTINGS);
    expect(reset.state.appearance).toEqual(DEFAULT_APPEARANCE);
    expect(
      reset.state.update({ type: "preset.delete", name: DEFAULT_MANUSCRIPT_PRESET.name }).issues[0]
        ?.code,
    ).toBe("preset-readonly");
  });

  test("saves a preset with the configuration at save time, not later in the batch", () => {
    const saved = createManuscriptState().update(
      { type: "preset.save", name: "文庫", overwrite: false },
      { type: "config.patch", patch: { settings: { charsPerLine: 40 } } },
    );

    expect(saved.state.settings.charsPerLine).toBe(40);
    expect(saved.state.presets[0]?.settings.charsPerLine).toBe(DEFAULT_SETTINGS.charsPerLine);
  });
});

describe("manuscript preferences codec", () => {
  test("round-trips current preferences without document or selection state", () => {
    const state = createManuscriptState({ text: "本文" }).update(
      { type: "zoom.set", zoom: { mode: "fit" } },
      { type: "preset.save", name: "保存", overwrite: false },
    ).state;

    const decoded = decodeManuscriptPreferences(encodeManuscriptPreferences(state));

    const preferences = decodedValue(decoded);
    expect(preferences.zoom).toEqual({ mode: "fit" });
    expect(preferences.presets.map(({ name }) => name)).toEqual(["保存"]);
    expect(preferences.settings).toEqual(DEFAULT_SETTINGS);
  });

  // Each rejection test mutates exactly one field of this payload, so a failing decode
  // can only be caused by the constraint under test.
  const validPayload = {
    version: 1,
    settings: DEFAULT_SETTINGS,
    appearance: DEFAULT_APPEARANCE,
    offsets: DEFAULT_OFFSETS,
    proofreading: DEFAULT_PROOFREADING_OPTIONS,
    zoom: DEFAULT_ZOOM,
    presets: [],
  };

  test("accepts a complete payload of the current version", () => {
    expect(decodeManuscriptPreferences(validPayload).ok).toBe(true);
  });

  test("rejects preferences from older versions", () => {
    const decoded = decodeManuscriptPreferences({ ...validPayload, version: 2 });

    expect(decoded.ok).toBe(false);
  });

  test("rejects a payload with invalid settings", () => {
    const decoded = decodeManuscriptPreferences({
      ...validPayload,
      settings: { ...DEFAULT_SETTINGS, charsPerLine: 0 },
    });

    expect(decoded.ok).toBe(false);
  });
});
