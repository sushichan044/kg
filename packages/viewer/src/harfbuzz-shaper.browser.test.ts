import { FontPreset } from "@sushichan044/kg-core";
import type { FontPresetId } from "@sushichan044/kg-core";
import { createShapedRunMeasurer } from "@sushichan044/kg-core/plugin";
import type { MeasurementRequest } from "@sushichan044/kg-core/plugin";
import { expect, test as base } from "vite-plus/test";
import { commands, server } from "vite-plus/test/browser";

import genEiRegularUrl from "../assets/GenEiKoburiMin6-R.ttf?url";
import rinBoldUrl from "../assets/RinMincho-Bold.ttf?url";
import rinRegularUrl from "../assets/RinMincho-Regular.ttf?url";
import { createHarfBuzzShaper } from "./harfbuzz-shaper";
import { cssFontFeatures } from "./typography-profile";
import { splitUprightHalfwidth } from "./upright-halfwidth";

import "./structural.css";

const TOLERANCE_EM = 0.002;
const PROBE_PX = 200;

type Subject = Readonly<{ id: string; preset: FontPresetId; weight: 400 | 700; url: string }>;

const subjects: readonly Subject[] = [
  { id: "rin-regular", preset: "mincho", weight: 400, url: rinRegularUrl },
  { id: "rin-bold", preset: "mincho", weight: 700, url: rinBoldUrl },
  { id: "genei-regular", preset: "genei-koburi", weight: 400, url: genEiRegularUrl },
];

const graphemes = {
  hiragana: ["あ", "い", "ぅ", "か", "が", "ぱ", "ゔ", "っ", "ゃ", "ゕ", "を", "ん"],
  katakana: ["ア", "ィ", "カ", "ガ", "ヴ", "ヷ", "ッ", "ヶ", "ン"],
  combining: ["あ゙", "か゚"],
  kanji: ["漢", "字", "日", "本", "語", "鬱", "龍", "𠮷", "辻", "々", "〆"],
  punctuation: Array.from("、。「」『』（）【】〈〉・ー…‥―—–～〜！？‼⁉"),
  quotes: Array.from("“”‘’\"'"),
  ascii: Array.from(
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?.,:;-_()[]{}<>/@#%&*+=~ ",
  ),
  fullwidth: Array.from("Ａｂ１＠％＋　"),
  halfwidth: [...Array.from("ｱｲﾞﾟ｢｣､｡ｰ"), "ｶﾞ", "ﾊﾟ"],
  symbols: Array.from("♪☆♡※→©°×÷"),
} as const;

const runs = [
  "water",
  "office",
  "Wave",
  "AVATAR",
  "Uncatalogued word",
  "ffi fl fi",
  "2026",
  "Hello, world.",
  "e-mail",
];
const rubyTexts = ["ふりがな", "ひらがな", "ルビ", "ゔぁ", "ruby", "ルビ・ルビ", "ー", "ABC", "ﾙﾋﾞ"];

// 強制した向きの計測で、ブラウザーが本文と違う描き方をする箇所
// 同じ WebKit でも OS ごとに描き方が違うので、`<browser>/<platform>` ごとに持つ
type KnownDifferences = Readonly<{
  // `<font>|<group>|<text>`
  keys: readonly string[];
  // 縦組みでも vmtx を使わず、横組みの送り幅で描くフォント
  // これらのフォントの upright とルビは、ブラウザーが横組みで描いた送り幅と一致する行だけをずれてよいものとする
  horizontalFonts: readonly string[];
}>;
const knownDifferences: Readonly<Record<string, KnownDifferences>> = {
  "chromium/darwin": { keys: [], horizontalFonts: [] },
  "chromium/linux": { keys: [], horizontalFonts: [] },
  // macOS の WebKit は縦の欧文に liga を適用する
  "webkit/darwin": { keys: ["genei-regular|upright/run|ffi fl fi"], horizontalFonts: [] },
  // Linux の WebKit は Rin の vmtx を読まない（GenEi の vmtx は読む）
  "webkit/linux": { keys: [], horizontalFonts: ["rin-regular", "rin-bold"] },
};

type Row = Readonly<{
  key: string;
  text: string;
  orientation: "upright" | "sideways";
  measured: number;
  browser: number;
  // ブラウザーが同じ文字列を横組みで描いた送り幅（カーニングなし）
  horizontalBrowser: number;
  difference: number;
}>;

const test = base.extend<{
  compare: (subject: Subject) => Promise<readonly Row[]>;
}>({
  compare: async ({}, use) => {
    const faces: FontFace[] = [];
    const disposers: Array<() => void> = [];
    try {
      await use(async (subject) => {
        const preset = FontPreset.of(subject.preset);
        const data = await (await fetch(subject.url)).arrayBuffer();
        const family = `KGAccuracy-${subject.id}`;
        const face = await new FontFace(family, data, {
          weight: String(subject.weight),
          style: "normal",
        }).load();
        document.fonts.add(face);
        faces.push(face);
        await document.fonts.ready;
        const shaper = await createHarfBuzzShaper([{ weight: subject.weight, data }]);
        disposers.push(shaper.dispose);
        const measurer = createShapedRunMeasurer(shaper);
        // 描画側の `.kgv-glyph` と同じ向き、フィーチャー、カーニングで計測する
        const probe = document.createElement("span");
        Object.assign(probe.style, {
          position: "fixed",
          top: "0",
          left: "0",
          visibility: "hidden",
          display: "inline-block",
          whiteSpace: "pre",
          writingMode: "vertical-rl",
          lineHeight: "1",
          fontFamily: `"${family}"`,
          fontWeight: String(subject.weight),
          fontFeatureSettings: cssFontFeatures(preset),
          fontSynthesis: "none",
          letterSpacing: "0",
          wordSpacing: "0",
          textRendering: "geometricPrecision",
        });
        const horizontalProbe = probe.cloneNode() as HTMLSpanElement;
        Object.assign(horizontalProbe.style, { writingMode: "horizontal-tb", fontKerning: "none" });
        document.body.append(probe, horizontalProbe);
        disposers.push(() => {
          probe.remove();
          horizontalProbe.remove();
        });

        const rows: Row[] = [];
        const check = (
          group: string,
          text: string,
          orientation: "upright" | "sideways",
          kind: "base" | "ruby",
          scale: number,
        ) => {
          const context = {
            text,
            style: { weight: subject.weight, slant: "normal" },
            fontPreset: subject.preset,
            fontSizeQ: 13,
            scale,
            writingMode: "vertical-rl",
          } as const;
          const request: MeasurementRequest =
            kind === "ruby"
              ? { ...context, kind, presentation: "mixed" }
              : { ...context, kind, presentation: orientation };
          const measured = measurer(request).advanceEm;
          probe.style.fontSize = `${PROBE_PX * scale}px`;
          probe.style.textOrientation = orientation;
          probe.lang = orientation === "sideways" ? "en" : "ja";
          probe.style.fontKerning =
            orientation === "sideways" && preset.rendering.westernKerning === "normal"
              ? "normal"
              : "none";
          // 正立の半角形は描画側の NovelViewer と同じく 1 字ずつ横組みの全角の箱に入れる
          probe.replaceChildren(
            ...(orientation === "upright"
              ? splitUprightHalfwidth(text).map((part) => {
                  if (!part.combined) return part.text;
                  const combined = document.createElement("span");
                  combined.className = "kgv-upright-halfwidth";
                  combined.textContent = part.text;
                  return combined;
                })
              : [text]),
          );
          const browser = probe.getBoundingClientRect().height / PROBE_PX;
          horizontalProbe.style.fontSize = probe.style.fontSize;
          horizontalProbe.lang = probe.lang;
          horizontalProbe.textContent = text;
          const horizontalBrowser = horizontalProbe.getBoundingClientRect().width / PROBE_PX;
          rows.push({
            key: `${subject.id}|${group}|${text}`,
            text,
            orientation,
            measured,
            browser,
            horizontalBrowser,
            difference: measured - browser,
          });
        };
        const covered = (text: string) =>
          Array.from(text).every((character) =>
            shaper.hasGlyph(character.codePointAt(0) ?? 0, subject.weight),
          );

        for (const [group, items] of Object.entries(graphemes)) {
          for (const text of items.filter(covered)) {
            check(`upright/${group}`, text, "upright", "base", 1);
            check(`sideways/${group}`, text, "sideways", "base", 1);
          }
        }
        for (const text of runs) {
          check("sideways/run", text, "sideways", "base", 1);
          check("upright/run", text, "upright", "base", 1);
        }
        for (const text of rubyTexts.filter(covered)) check("ruby", text, "upright", "ruby", 0.5);
        return rows;
      });
    } finally {
      for (const dispose of disposers) dispose();
      for (const face of faces) document.fonts.delete(face);
    }
  },
});

test.for(subjects)("matches the browser advances for $id", async (subject, { compare }) => {
  const rows = await compare(subject);

  const mismatches = rows.filter(({ difference }) => Math.abs(difference) > TOLERANCE_EM);
  const known = knownDifferences[`${server.browser}/${server.platform}`];
  expect.assert(known, `no expectations for ${server.browser}/${server.platform}`);
  const drawnHorizontally = known.horizontalFonts.includes(subject.id);
  const expected = [
    ...known.keys.filter((key) => key.startsWith(`${subject.id}|`)),
    ...(drawnHorizontally
      ? mismatches
          .filter(
            ({ orientation, browser, horizontalBrowser }) =>
              orientation === "upright" && Math.abs(browser - horizontalBrowser) <= TOLERANCE_EM,
          )
          .map(({ key }) => key)
      : []),
  ];
  await commands.writeFile(
    `${server.config.root}/font-proof/.cache/evidence/${server.browser}-shaper-${subject.id}.json`,
    JSON.stringify(
      {
        compared: rows.length,
        maxAbsDifference: Math.max(...rows.map(({ difference }) => Math.abs(difference))),
        mismatches,
      },
      null,
      2,
    ),
  );

  expect(rows.length).toBeGreaterThan(300);
  expect(mismatches.map(({ key }) => key).toSorted()).toEqual(expected.toSorted());
});
