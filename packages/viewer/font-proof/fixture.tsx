import {
  composeManuscript,
  kakuyomuParser,
  NovelCompositionSettings,
  parseManuscript,
} from "@sushichan044/kg-core";
import type { ManuscriptDiagnostic } from "@sushichan044/kg-core";
import { createNovelComposer, RunMeasurement } from "@sushichan044/kg-core/plugin";
import type { RunMeasurer } from "@sushichan044/kg-core/plugin";
import * as v from "valibot";
import { expect, test as base } from "vite-plus/test";
import { commands, page, server } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import geneiFontUrl from "../assets/GenEiKoburiMin6-R.ttf?url";
import { NovelViewer } from "../src/NovelViewer";
import { loadGenEiKoburiTypography } from "../src/typography";

import "../src/styles.css";

const fixtureSchema = v.object({
  harfbuzzVersion: v.string(),
  fonts: v.array(
    v.object({
      id: v.picklist(["genei", "source-serif"]),
      family: v.string(),
      file: v.string(),
      sha256: v.string(),
      upem: v.number(),
      version: v.string(),
    }),
  ),
  measurements: v.record(v.string(), v.object({ measurement: RunMeasurement.schema })),
});

export type ProofFont = "genei" | "source-serif";
type ProofOptions = Readonly<{
  font?: ProofFont;
  kern?: boolean;
  liga?: boolean;
  fontSizePt?: number;
  lineLengthEm?: number;
  diagnostics?: readonly ManuscriptDiagnostic[];
  onDiagnosticSelect?: (diagnostic: ManuscriptDiagnostic) => void;
}>;

async function loadFonts() {
  await page.viewport(1000, 1000);
  const cache = `${server.config.root}/font-proof/.cache`;
  const raw: unknown = JSON.parse(await commands.readFile(`${cache}/measurements.json`));
  const fixture = v.parse(fixtureSchema, raw);
  const faces: FontFace[] = [];
  await Promise.all(
    fixture.fonts.map(async (font) => {
      const encoded = await commands.readFile(`${cache}/${font.file}`, "base64");
      const data = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)).buffer;
      const digest = await crypto.subtle.digest("SHA-256", data);
      const sha = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      expect(sha).toBe(font.sha256);
      const face = new FontFace(font.family, data);
      await face.load();
      document.fonts.add(face);
      faces.push(face);
      expect(face.status).toBe("loaded");
    }),
  );
  await document.fonts.ready;
  const loaded = await loadGenEiKoburiTypography({ fontUrl: geneiFontUrl });
  expect.assert(loaded.ok);
  return { fixture, faces, typography: loaded.value };
}

type LoadedFonts = Awaited<ReturnType<typeof loadFonts>>;

function measurement(
  fonts: LoadedFonts,
  font: ProofFont,
  text: string,
  direction: "ltr" | "ttb",
  kern = true,
  liga = true,
) {
  const key = JSON.stringify([font, direction, kern, liga, text]);
  const result = fonts.fixture.measurements[key];
  expect.assert(result !== undefined, `missing real-font measurement: ${key}`);
  return result.measurement;
}

function provider(fonts: LoadedFonts, options: ProofOptions): RunMeasurer {
  if (options.font !== "source-serif" && options.kern !== false && options.liga !== false)
    return fonts.typography.measurer;
  return (request) => {
    expect(request.presentation).not.toBe("tate-chu-yoko");
    const sideways = request.presentation === "sideways";
    const raw = measurement(
      fonts,
      sideways ? (options.font ?? "genei") : "genei",
      request.text,
      sideways ? "ltr" : "ttb",
      options.kern ?? true,
      options.liga ?? true,
    );
    expect.assert(raw.kind === "clustered");
    return {
      ...raw,
      advanceEm: raw.advanceEm * request.scale,
      clusters: raw.clusters.map((cluster) => ({
        textRange: cluster.textRange,
        layoutSpan: {
          offsetEm: cluster.layoutSpan.offsetEm * request.scale,
          advanceEm: cluster.layoutSpan.advanceEm * request.scale,
        },
        renderSpan: {
          offsetEm: cluster.renderSpan.offsetEm * request.scale,
          advanceEm: cluster.renderSpan.advanceEm * request.scale,
        },
      })),
    };
  };
}

async function renderProof(fonts: LoadedFonts, text: string, options: ProofOptions = {}) {
  const parsed = parseManuscript(text, { parser: kakuyomuParser });
  expect.assert(parsed.ok);
  const composed = composeManuscript(parsed.value, {
    composer: createNovelComposer({ measurer: provider(fonts, options) }),
    settings: {
      ...NovelCompositionSettings.defaults,
      appearance: {
        ...NovelCompositionSettings.defaults.appearance,
        fontSizePt: options.fontSizePt ?? 9,
      },
      flow: {
        ...NovelCompositionSettings.defaults.flow,
        lineLengthEm: options.lineLengthEm ?? 27,
        linesPerStage: 10,
        stagesPerPage: 1,
      },
    },
  });
  expect.assert(composed.ok);
  const western = options.font === "source-serif" ? "KGProofSourceSerif" : "KGProofGenei";
  const screen = await render(
    <section className="font-proof" lang="ja">
      <style>{`
        .font-proof .kgv-glyph, .font-proof .kgv-ruby {
          font-family: KGProofGenei;
          font-kerning: none;
          font-feature-settings: "palt" 0, "vpal" 0, "halt" 0, "vhal" 0, "vkrn" 0, "liga" ${options.liga === false ? 0 : 1};
          font-synthesis: none;
          text-rendering: geometricPrecision;
        }
        .font-proof .kgv-glyph-sideways {
          font-family: ${western};
          font-kerning: ${options.kern === false ? "none" : "normal"};
        }
        .font-proof .native-references { display: flex; gap: 2rem; padding: 1rem; }
      `}</style>
      <div className="native-references" aria-label="Native font references" />
      <NovelViewer
        typography={
          options.font !== "source-serif" && options.kern !== false && options.liga !== false
            ? fonts.typography
            : undefined
        }
        composed={composed.value}
        diagnostics={options.diagnostics}
        onDiagnosticSelect={options.onDiagnosticSelect}
        fit={false}
      />
    </section>,
  );
  for (const glyph of screen.container.querySelectorAll<HTMLElement>(".kgv-glyph-sideways"))
    glyph.lang = "en";
  await document.fonts.ready;
  const lines = composed.value.layout.pages.flatMap(({ stages }) =>
    stages.flatMap(({ lines: stageLines }) => stageLines.filter(({ range }) => range !== null)),
  );
  const glyph = (value: string) => {
    const element = [...screen.container.querySelectorAll<HTMLElement>(".kgv-glyph")].find(
      (element) => element.textContent === value,
    );
    expect.assert(element !== undefined, `missing rendered glyph: ${value}`);
    return element;
  };
  const native = (value: string) => {
    const original = glyph(value);
    const style = getComputedStyle(original);
    const reference = document.createElement("span");
    reference.lang = original.lang;
    reference.textContent = value;
    Object.assign(reference.style, {
      display: "inline-block",
      writingMode: style.writingMode,
      textOrientation: style.textOrientation,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      lineHeight: "1",
      fontKerning: style.fontKerning,
      fontFeatureSettings: style.fontFeatureSettings,
      fontVariantLigatures: style.fontVariantLigatures,
      letterSpacing: "normal",
      wordSpacing: "normal",
      whiteSpace: "pre",
      fontSynthesis: "none",
      textRendering: style.textRendering,
    });
    const container = screen.container.querySelector(".native-references");
    expect.assert(container !== null);
    container.append(reference);
    return reference;
  };
  return {
    screen,
    composed: composed.value,
    parsed: parsed.value,
    lines,
    glyph,
    native,
    metadata: fonts.fixture,
  };
}

export async function recordProof(
  label: string,
  proof: Awaited<ReturnType<typeof renderProof>>,
  measurements: Readonly<Record<string, number | string>>,
) {
  const path = `${server.config.root}/font-proof/.cache/evidence/${server.browser}-${label}`;
  const element = proof.screen.container.querySelector(".font-proof");
  expect.assert(element !== null);
  const units = proof.lines
    .flatMap(({ items }) => items)
    .filter((item) => item.kind === "glyph" || item.kind === "combined-glyph");
  const glyphs = [...proof.screen.container.querySelectorAll<HTMLElement>(".kgv-glyph")];
  expect(glyphs).toHaveLength(units.length);
  const geometry = units.map((unit, index) => {
    const glyph = glyphs[index];
    expect.assert(glyph !== undefined);
    const line = glyph.closest(".kgv-line");
    expect.assert(line !== null);
    const fontPx = Number.parseFloat(getComputedStyle(glyph).fontSize);
    const bounds = glyph.getBoundingClientRect();
    return {
      value: unit.value,
      fontPx,
      heightPx: bounds.height,
      widthErrorPx: Math.abs(bounds.height - unit.renderSpan.advanceEm * fontPx),
      originErrorPx: Math.abs(
        bounds.top - line.getBoundingClientRect().top - unit.renderSpan.offsetEm * fontPx,
      ),
    };
  });
  for (const sample of geometry) {
    expect(sample.widthErrorPx, `${sample.value} drawing width`).toBeLessThanOrEqual(0.25);
    expect(sample.originErrorPx, `${sample.value} drawing origin`).toBeLessThanOrEqual(0.25);
  }
  await commands.writeFile(
    `${path}.json`,
    JSON.stringify(
      {
        browser: server.browser,
        userAgent: navigator.userAgent,
        harfbuzzVersion: proof.metadata.harfbuzzVersion,
        fonts: proof.metadata.fonts,
        measurements,
        geometry,
        lines: proof.lines,
      },
      null,
      2,
    ),
  );
  await page.screenshot({ element, path: `${path}.png` });
}

export const test = base.extend<{
  fonts: LoadedFonts;
  renderProof: (text: string, options?: ProofOptions) => ReturnType<typeof renderProof>;
  measurement: (
    font: ProofFont,
    text: string,
    direction?: "ltr" | "ttb",
    kern?: boolean,
    liga?: boolean,
  ) => RunMeasurement;
}>({
  fonts: async ({}, use) => {
    const fonts = await loadFonts();
    try {
      await use(fonts);
    } finally {
      fonts.typography.dispose();
      for (const face of fonts.faces) document.fonts.delete(face);
    }
  },
  renderProof: async ({ fonts }, use) => {
    await use((text, options) => renderProof(fonts, text, options));
  },
  measurement: async ({ fonts }, use) => {
    await use((font, text, direction = "ltr", kern = true, liga = true) =>
      measurement(fonts, font, text, direction, kern, liga),
    );
  },
});
