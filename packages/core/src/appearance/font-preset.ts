import type { FontPresetId } from "./font-preset-id";

export type FontPreset = Readonly<{ id: FontPresetId; label: string; family: string }>;

const FONT_PRESETS = {
  mincho: {
    id: "mincho",
    label: "明朝",
    family: '"Yu Mincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", serif',
  },
  gothic: {
    id: "gothic",
    label: "ゴシック",
    family: '"Yu Gothic", "Hiragino Kaku Gothic ProN", system-ui, sans-serif',
  },
} as const satisfies Record<FontPresetId, FontPreset>;

const ALL: readonly FontPreset[] = Object.values(FONT_PRESETS);

export const FontPreset = {
  of: (id: FontPresetId): FontPreset => FONT_PRESETS[id],
  all: ALL,
} as const;
