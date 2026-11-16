import type { FontPresetId } from "./font-preset-id";

export type FontTextTransform = "combine-kana-voicing-marks";

export type FontPreset = Readonly<{
  id: FontPresetId;
  label: string;
  fontName: string;
  family: string;
  textTransforms: readonly FontTextTransform[];
  rendering: Readonly<{
    features: Readonly<Record<string, number>>;
    westernKerning: "normal" | "none";
    synthesis: "weight style" | "style";
  }>;
}>;

const FIXED_PITCH = {
  features: { palt: 0, vpal: 0, halt: 0, vhal: 0, vkrn: 0, liga: 1 },
  westernKerning: "normal",
  synthesis: "weight style",
} as const;

const FONT_PRESETS = {
  mincho: {
    id: "mincho",
    label: "倫明朝",
    fontName: "KGRinMincho100",
    family: '"KGRinMincho100", "Yu Mincho", "Hiragino Mincho ProN", serif',
    textTransforms: ["combine-kana-voicing-marks"],
    rendering: { ...FIXED_PITCH, synthesis: "style" },
  },
  "genei-koburi": {
    id: "genei-koburi",
    label: "源暎こぶり明朝",
    fontName: "KGGenEiKoburi61",
    family: '"KGGenEiKoburi61", "Yu Mincho", "Hiragino Mincho ProN", serif',
    textTransforms: [],
    rendering: FIXED_PITCH,
  },
} as const satisfies Record<FontPresetId, FontPreset>;

const ALL: readonly FontPreset[] = Object.values(FONT_PRESETS);

export const FontPreset = {
  of: (id: FontPresetId): FontPreset => FONT_PRESETS[id],
  all: ALL,
} as const;
