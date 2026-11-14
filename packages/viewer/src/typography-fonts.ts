import type { FontPresetId } from "@sushichan044/kg-core";

type TypographyFace = Readonly<{
  weight: 400 | 700;
  url: URL;
  sha256: string;
}>;

export const typographyFonts: Readonly<Record<FontPresetId, readonly TypographyFace[]>> = {
  mincho: [
    {
      weight: 400,
      url: new URL("../assets/RinMincho-Regular.ttf", import.meta.url),
      sha256: "ccd33fd39367fe59b65d2973a2c4aa64e5beeaa50813a53924d1cb9f7891b0ff",
    },
    {
      weight: 700,
      url: new URL("../assets/RinMincho-Bold.ttf", import.meta.url),
      sha256: "8296b57e1f2a95e0f3149fbb8d7a12761aa5a525cb35a4825ae650b3ae219d40",
    },
  ],
  "genei-koburi": [
    {
      weight: 400,
      url: new URL("../assets/GenEiKoburiMin6-R.ttf", import.meta.url),
      sha256: "c27fb4039ac9fae19152716992b5b9d07558e24f6cccea7b0c1abd0109235166",
    },
  ],
  gothic: [],
};
