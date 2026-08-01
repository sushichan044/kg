import { parseFontSizePt, parseGridSetting, parseLineOffset } from "@sushichan044/kg-core";
import type {
  GridSettings,
  ManuscriptAction,
  ManuscriptController,
  ManuscriptOffsets,
  ManuscriptState,
  ManuscriptTransaction,
} from "@sushichan044/kg-core";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

export type SettingField = keyof GridSettings;

export type OffsetField =
  | "document.leading"
  | "document.trailing"
  | "page.leading"
  | "page.trailing"
  | "stage.leading"
  | "stage.trailing";

interface SettingsDrafts {
  settings: Record<SettingField, string>;
  invalidSettings: Record<SettingField, boolean>;
  fontSizePt: string;
  isFontSizePtInvalid: boolean;
  offsets: Record<OffsetField, string>;
  invalidOffsets: Record<OffsetField, boolean>;
  setSetting: (field: SettingField, raw: string) => void;
  setFontSizePt: (raw: string) => void;
  setOffset: (field: OffsetField, raw: string) => void;
}

interface ViewerContextValue {
  controller: ManuscriptController;
  drafts: SettingsDrafts;
  effectiveZoomPercent: number;
  setEffectiveZoomPercent: (percent: number) => void;
}

const ViewerContext = createContext<ViewerContextValue | null>(null);

function settingDrafts(settings: GridSettings): Record<SettingField, string> {
  return {
    charsPerLine: String(settings.charsPerLine),
    linesPerStage: String(settings.linesPerStage),
    stagesPerPage: String(settings.stagesPerPage),
  };
}

function offsetDrafts(offsets: ManuscriptOffsets): Record<OffsetField, string> {
  return {
    "document.leading": String(offsets.document.leading),
    "document.trailing": String(offsets.document.trailing),
    "page.leading": String(offsets.page.leading),
    "page.trailing": String(offsets.page.trailing),
    "stage.leading": String(offsets.stage.leading),
    "stage.trailing": String(offsets.stage.trailing),
  };
}

function useControllerState(controller: ManuscriptController): ManuscriptState {
  const subscribe = useCallback(
    (notify: () => void) =>
      controller.subscribe(() => {
        notify();
      }),
    [controller],
  );
  const snapshot = useCallback(() => controller.state, [controller]);

  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export interface ManuscriptProviderProps {
  controller: ManuscriptController;
  children: ReactNode;
}

export function ManuscriptProvider({ controller, children }: ManuscriptProviderProps) {
  const state = useControllerState(controller);
  const [invalidSettingDrafts, setInvalidSettingDrafts] = useState<
    Partial<Record<SettingField, string>>
  >({});
  const [invalidFontSizePtDraft, setInvalidFontSizePtDraft] = useState<string | null>(null);
  const [invalidOffsetDrafts, setInvalidOffsetDrafts] = useState<
    Partial<Record<OffsetField, string>>
  >({});
  const [effectiveZoomPercent, setEffectiveZoomPercent] = useState<number>(
    state.zoom.mode === "fixed" ? state.zoom.percent : 100,
  );
  const setSetting = useCallback(
    (field: SettingField, raw: string) => {
      const value = parseGridSetting(field, raw);
      if (value === null) {
        setInvalidSettingDrafts((current) => ({ ...current, [field]: raw }));
        return;
      }
      setInvalidSettingDrafts((current) => ({ ...current, [field]: undefined }));
      controller.dispatch({ type: "config.patch", patch: { settings: { [field]: value } } });
    },
    [controller],
  );

  const setFontSizePt = useCallback(
    (raw: string) => {
      const value = parseFontSizePt(raw);
      if (value === null) {
        setInvalidFontSizePtDraft(raw);
        return;
      }
      setInvalidFontSizePtDraft(null);
      controller.dispatch({
        type: "config.patch",
        patch: { appearance: { fontSizePt: value } },
      });
    },
    [controller],
  );

  const setOffset = useCallback(
    (field: OffsetField, raw: string) => {
      const value = parseLineOffset(raw, field.startsWith("document."));
      if (value === null) {
        setInvalidOffsetDrafts((current) => ({ ...current, [field]: raw }));
        return;
      }
      setInvalidOffsetDrafts((current) => ({ ...current, [field]: undefined }));
      const [scope, edge] = field.split(".") as [
        keyof ManuscriptOffsets,
        keyof ManuscriptOffsets["document"],
      ];
      controller.dispatch({
        type: "config.patch",
        patch: { offsets: { [scope]: { [edge]: value } } },
      });
    },
    [controller],
  );

  const drafts = useMemo<SettingsDrafts>(() => {
    const persistedSettings = settingDrafts(state.settings);
    const persistedOffsets = offsetDrafts(state.offsets);

    return {
      settings: {
        charsPerLine: invalidSettingDrafts.charsPerLine ?? persistedSettings.charsPerLine,
        linesPerStage: invalidSettingDrafts.linesPerStage ?? persistedSettings.linesPerStage,
        stagesPerPage: invalidSettingDrafts.stagesPerPage ?? persistedSettings.stagesPerPage,
      },
      invalidSettings: {
        charsPerLine: invalidSettingDrafts.charsPerLine !== undefined,
        linesPerStage: invalidSettingDrafts.linesPerStage !== undefined,
        stagesPerPage: invalidSettingDrafts.stagesPerPage !== undefined,
      },
      fontSizePt: invalidFontSizePtDraft ?? String(state.appearance.fontSizePt),
      isFontSizePtInvalid: invalidFontSizePtDraft !== null,
      offsets: {
        "document.leading":
          invalidOffsetDrafts["document.leading"] ?? persistedOffsets["document.leading"],
        "document.trailing":
          invalidOffsetDrafts["document.trailing"] ?? persistedOffsets["document.trailing"],
        "page.leading": invalidOffsetDrafts["page.leading"] ?? persistedOffsets["page.leading"],
        "page.trailing": invalidOffsetDrafts["page.trailing"] ?? persistedOffsets["page.trailing"],
        "stage.leading": invalidOffsetDrafts["stage.leading"] ?? persistedOffsets["stage.leading"],
        "stage.trailing":
          invalidOffsetDrafts["stage.trailing"] ?? persistedOffsets["stage.trailing"],
      },
      invalidOffsets: {
        "document.leading": invalidOffsetDrafts["document.leading"] !== undefined,
        "document.trailing": invalidOffsetDrafts["document.trailing"] !== undefined,
        "page.leading": invalidOffsetDrafts["page.leading"] !== undefined,
        "page.trailing": invalidOffsetDrafts["page.trailing"] !== undefined,
        "stage.leading": invalidOffsetDrafts["stage.leading"] !== undefined,
        "stage.trailing": invalidOffsetDrafts["stage.trailing"] !== undefined,
      },
      setSetting,
      setFontSizePt,
      setOffset,
    };
  }, [
    invalidFontSizePtDraft,
    invalidOffsetDrafts,
    invalidSettingDrafts,
    setFontSizePt,
    setOffset,
    setSetting,
    state.appearance.fontSizePt,
    state.offsets,
    state.settings,
  ]);
  const value = useMemo<ViewerContextValue>(
    () => ({ controller, drafts, effectiveZoomPercent, setEffectiveZoomPercent }),
    [controller, drafts, effectiveZoomPercent],
  );

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

function useViewerContext(): ViewerContextValue {
  const value = useContext(ViewerContext);
  if (value === null) {
    throw new Error("viewer components must be rendered inside ManuscriptProvider");
  }

  return value;
}

export function useManuscriptState<T>(selector: (state: ManuscriptState) => T): T {
  const { controller } = useViewerContext();
  const state = useControllerState(controller);

  return selector(state);
}

export function useManuscriptDispatch(): (...actions: ManuscriptAction[]) => ManuscriptTransaction {
  const { controller } = useViewerContext();

  return useCallback((...actions) => controller.dispatch(...actions), [controller]);
}

export function useViewerSettings(): SettingsDrafts {
  return useViewerContext().drafts;
}

export function useEffectiveZoom(): [number, (percent: number) => void] {
  const { effectiveZoomPercent, setEffectiveZoomPercent } = useViewerContext();

  return [effectiveZoomPercent, setEffectiveZoomPercent];
}
