import { composeManuscript, ManuscriptDiagnostic, novelComposer } from "@sushichan044/kg-core";
import { NamespacedId } from "@sushichan044/kg-core/plugin";
import { expect } from "vite-plus/test";

import { recordProof, test } from "./fixture";

const TOLERANCE_PX = 0.25;

test.for([
  { font: "genei", fontSizePt: 9 },
  { font: "genei", fontSizePt: 12 },
  { font: "source-serif", fontSizePt: 9 },
  { font: "source-serif", fontSizePt: 12 },
] as const)(
  "matches the real run widths and origins for $font at $fontSizePt pt",
  async ({ font, fontSizePt }, { renderProof, measurement }) => {
    const proof = await renderProof("あwaterい", { font, fontSizePt });
    const glyph = proof.glyph("water");
    const native = proof.native("water");
    const measured = measurement(font, "water");
    const unit = proof.lines
      .flatMap(({ items }) => items)
      .find((item) => item.kind === "combined-glyph");
    expect.assert(unit !== undefined);
    const line = glyph.closest(".kgv-line");
    expect.assert(line !== null);
    const fontPx = Number.parseFloat(getComputedStyle(glyph).fontSize);

    expect(unit.sources.map(({ kind }) => kind)).toEqual([
      "exact",
      "exact",
      "exact",
      "exact",
      "exact",
    ]);
    expect(
      Math.abs(glyph.getBoundingClientRect().height - native.getBoundingClientRect().height),
    ).toBeLessThanOrEqual(TOLERANCE_PX);
    expect(
      Math.abs(glyph.getBoundingClientRect().height - measured.advanceEm * fontPx),
    ).toBeLessThanOrEqual(TOLERANCE_PX);
    expect(
      Math.abs(
        glyph.getBoundingClientRect().top -
          line.getBoundingClientRect().top -
          unit.renderSpan.offsetEm * fontPx,
      ),
    ).toBeLessThanOrEqual(TOLERANCE_PX);
    expect(unit.layoutSpan.offsetEm).toBe(1.25);
    await recordProof(`${font}-water-${fontSizePt}pt`, proof, {
      font,
      fontSizePt,
      text: "water",
      measuredEm: measured.advanceEm,
      browserPx: glyph.getBoundingClientRect().height,
      nativePx: native.getBoundingClientRect().height,
    });
  },
);

test.for([9, 12])(
  "keeps small Japanese faces on a one-em pitch at %spt",
  async (fontSizePt, { renderProof, measurement }) => {
    const proof = await renderProof("あいう漢字カナ", { fontSizePt });
    const units = proof.lines.flatMap(({ items }) => items).filter((item) => item.kind === "glyph");

    expect(units).toHaveLength(7);
    for (const [index, unit] of units.entries()) {
      const glyph = proof.glyph(unit.value);
      const native = proof.native(unit.value);
      const fontPx = Number.parseFloat(getComputedStyle(glyph).fontSize);
      const line = glyph.closest(".kgv-line");
      expect.assert(line !== null);

      expect(measurement("genei", unit.value, "ttb").advanceEm).toBe(1);
      expect(unit.layoutSpan).toEqual({ offsetEm: index, advanceEm: 1 });
      expect(
        Math.abs(glyph.getBoundingClientRect().height - native.getBoundingClientRect().height),
      ).toBeLessThanOrEqual(TOLERANCE_PX);
      expect(
        Math.abs(
          glyph.getBoundingClientRect().top - line.getBoundingClientRect().top - index * fontPx,
        ),
      ).toBeLessThanOrEqual(TOLERANCE_PX);
    }
    await recordProof(`genei-japanese-${fontSizePt}pt`, proof, { fontSizePt, pitchEm: 1 });
  },
);

test.for([9, 12])(
  "preserves the real ffi ligature and its shared sources at %spt",
  async (fontSizePt, { renderProof, measurement }) => {
    const on = measurement("genei", "office");
    const off = measurement("genei", "office", "ltr", true, false);
    const proof = await renderProof("あofficeい", { fontSizePt });
    const unit = proof.lines
      .flatMap(({ items }) => items)
      .find((item) => item.kind === "combined-glyph");
    expect.assert(unit !== undefined);
    const shared = unit.sources.find(({ kind }) => kind === "shared");
    expect.assert(shared?.kind === "shared");
    const glyph = proof.glyph("office");
    const native = proof.native("office");
    const onPx = glyph.getBoundingClientRect().height;

    expect(on.advanceEm).toBe(2733 / 1024);
    expect(off.advanceEm).toBe(2831 / 1024);
    expect(shared.ranges).toHaveLength(3);
    expect(shared.ranges.map(({ display }) => display)).toEqual([
      { start: 2, end: 3 },
      { start: 3, end: 4 },
      { start: 4, end: 5 },
    ]);
    expect(Math.abs(onPx - native.getBoundingClientRect().height)).toBeLessThanOrEqual(
      TOLERANCE_PX,
    );
    await recordProof(`genei-office-on-${fontSizePt}pt`, proof, {
      fontSizePt,
      text: "office",
      onEm: on.advanceEm,
      onPx,
    });
    const unligated = await renderProof("あofficeい", { fontSizePt, liga: false });
    const offGlyph = unligated.glyph("office");
    const fontPx = Number.parseFloat(getComputedStyle(offGlyph).fontSize);
    const offPx = offGlyph.getBoundingClientRect().height;

    expect(Math.abs(offPx - onPx - (off.advanceEm - on.advanceEm) * fontPx)).toBeLessThanOrEqual(
      TOLERANCE_PX,
    );
    await recordProof(`genei-office-${fontSizePt}pt`, unligated, {
      font: "genei",
      fontSizePt,
      text: "office",
      onEm: on.advanceEm,
      offEm: off.advanceEm,
      onPx,
      offPx,
    });
  },
);

test.for([9, 12])(
  "applies Source Serif pair kerning at %spt",
  async (fontSizePt, { renderProof, measurement }) => {
    const on = measurement("source-serif", "Wave");
    const off = measurement("source-serif", "Wave", "ltr", false);
    const proof = await renderProof("あWaveい", { font: "source-serif", fontSizePt });
    const glyph = proof.glyph("Wave");
    const native = proof.native("Wave");
    const onPx = glyph.getBoundingClientRect().height;

    expect(on.advanceEm).toBe(2.376);
    expect(off.advanceEm).toBe(2.486);
    expect(Math.abs(onPx - native.getBoundingClientRect().height)).toBeLessThanOrEqual(
      TOLERANCE_PX,
    );
    await recordProof(`source-serif-Wave-on-${fontSizePt}pt`, proof, {
      fontSizePt,
      text: "Wave",
      onEm: on.advanceEm,
      onPx,
    });
    const unkerned = await renderProof("あWaveい", {
      font: "source-serif",
      fontSizePt,
      kern: false,
    });
    const offGlyph = unkerned.glyph("Wave");
    const offPx = offGlyph.getBoundingClientRect().height;
    const fontPx = Number.parseFloat(getComputedStyle(offGlyph).fontSize);

    expect(offPx).toBeGreaterThan(onPx);
    expect(Math.abs(offPx - onPx - (off.advanceEm - on.advanceEm) * fontPx)).toBeLessThanOrEqual(
      TOLERANCE_PX,
    );
    expect(measurement("genei", "Wave").advanceEm).toBe(
      measurement("genei", "Wave", "ltr", false).advanceEm,
    );
    await recordProof(`source-serif-Wave-${fontSizePt}pt`, unkerned, {
      font: "source-serif",
      fontSizePt,
      text: "Wave",
      onEm: on.advanceEm,
      offEm: off.advanceEm,
      onPx,
      offPx,
    });
  },
);

test("keeps combining dakuten and supplementary characters on grapheme boundaries", async ({
  renderProof,
  measurement,
}) => {
  const proof = await renderProof("あ゙が𠮷");
  const units = proof.lines.flatMap(({ items }) => items).filter((item) => item.kind === "glyph");

  expect(units.map(({ value }) => value)).toEqual(["あ゙", "が", "𠮷"]);
  for (const text of ["あ゙", "が", "𠮷"]) {
    const measured = measurement("genei", text, "ttb");
    expect.assert(measured.kind === "clustered");
    expect(measured.clusters).toHaveLength(1);
    expect(measured.clusters[0]?.textRange).toEqual({ start: 0, end: 2 });
    const glyph = proof.glyph(text);
    expect(
      Math.abs(
        glyph.getBoundingClientRect().height - proof.native(text).getBoundingClientRect().height,
      ),
    ).toBeLessThanOrEqual(TOLERANCE_PX);
  }
});

test.for([9, 12])(
  "preserves real vertical punctuation and half-em boxes at %spt",
  async (fontSizePt, { renderProof }) => {
    const proof = await renderProof("「あいう、漢字。ー」", { fontSizePt });
    const units = proof.lines.flatMap(({ items }) => items).filter((item) => item.kind === "glyph");

    for (const value of ["「", "、", "。", "」"]) {
      const unit = units.find((item) => item.value === value);
      expect.assert(unit !== undefined);
      expect(unit.layoutSpan.advanceEm).toBe(0.5);
      expect(unit.renderSpan.advanceEm).toBe(1);
      const glyph = proof.glyph(value);
      expect(
        Math.abs(
          glyph.getBoundingClientRect().height - proof.native(value).getBoundingClientRect().height,
        ),
      ).toBeLessThanOrEqual(TOLERANCE_PX);
    }
    proof.native("ー");
    await recordProof(`genei-punctuation-${fontSizePt}pt`, proof, { fontSizePt });
  },
);

test("carries actual widths through ruby, punctuation and shared-source diagnostic bands", async ({
  renderProof,
  measurement,
}) => {
  const text = "｜漢《かん》waterとoffice、字。";
  const first = await renderProof(text);
  const member = first.parsed.graphemes.find(({ value }) => value === "f");
  expect.assert(member !== undefined);
  const diagnostic = ManuscriptDiagnostic.of({
    source: text,
    range: member.range,
    code: "font-proof",
    message: "Ligature member",
    origin: { kind: "rule", id: NamespacedId.of("example/font-proof") },
    severity: "warning",
  });

  let selected: ManuscriptDiagnostic | undefined;
  const proof = await renderProof(text, {
    diagnostics: [diagnostic],
    onDiagnosticSelect: (found) => {
      selected = found;
    },
  });
  const line = proof.lines[0];
  expect.assert(line !== undefined);
  const unit = line.items.find((item) => item.kind === "combined-glyph" && item.value === "office");
  expect.assert(unit?.kind === "combined-glyph");
  const shared = unit.sources.find(({ kind }) => kind === "shared");
  expect.assert(shared?.kind === "shared");
  const band = proof.screen.container.querySelector<HTMLElement>(".kgv-diagnostic-band");
  expect.assert(band !== null);
  const ruby = proof.screen.container.querySelector<HTMLElement>(".kgv-ruby");
  expect.assert(ruby !== null);

  expect(unit.layoutSpan.advanceEm).toBe(measurement("genei", "office").advanceEm);
  expect(Number(band.style.getPropertyValue("--kgv-band-offset"))).toBe(shared.layoutSpan.offsetEm);
  expect(Number(band.style.getPropertyValue("--kgv-band-length"))).toBe(
    shared.layoutSpan.advanceEm,
  );
  expect(ruby.textContent).toContain("かん");
  const punctuation = line.items.find((item) => item.kind === "glyph" && item.value === "、");
  expect.assert(punctuation?.kind === "glyph");
  expect(punctuation.layoutSpan.advanceEm).toBe(0.5);
  const glyph = proof.glyph("office");
  const fontPx = Number.parseFloat(getComputedStyle(glyph).fontSize);
  expect(
    Math.abs(band.getBoundingClientRect().height - shared.layoutSpan.advanceEm * fontPx),
  ).toBeLessThanOrEqual(TOLERANCE_PX);
  await proof.screen.getByRole("button", { name: /Ligature member/u }).click();
  expect.assert(selected !== undefined);
  expect(selected.range).toEqual(member.range);
  proof.native("office");
  proof.native("water");
  await recordProof("genei-mixed-ruby-diagnostic", proof, { fontSizePt: 9, text });
});

test("selects a different break using real ligature width instead of logical half-em letters", async ({
  renderProof,
}) => {
  const proof = await renderProof("漢漢漢漢漢漢漢office字", { lineLengthEm: 10 });
  const logical = composeManuscript(proof.parsed, {
    composer: novelComposer,
    settings: proof.composed.settings,
  });
  expect.assert(logical.ok);
  const logicalLine = logical.value.layout.pages[0]?.stages[0]?.lines[0];
  expect.assert(logicalLine !== undefined);

  expect(
    proof.lines[0]?.items.some((item) => item.kind === "combined-glyph" && item.value === "office"),
  ).toBe(true);
  expect(logicalLine.items.some((item) => item.kind === "glyph" && item.value === "o")).toBe(false);
});

test("keeps a real oversized Western run whole on its overflow line", async ({
  renderProof,
  measurement,
}) => {
  const text = "TypographyTypography";
  const proof = await renderProof(text, { lineLengthEm: 10 });
  const unit = proof.lines[0]?.items.find((item) => item.kind === "combined-glyph");
  expect.assert(unit?.kind === "combined-glyph");

  expect(proof.lines).toHaveLength(1);
  expect(unit.value).toBe(text);
  expect(unit.layoutSpan.advanceEm).toBeGreaterThan(10);
  expect(unit.layoutSpan.advanceEm).toBe(measurement("genei", text).advanceEm);
  const glyph = proof.glyph(text);
  expect(
    Math.abs(
      glyph.getBoundingClientRect().height - proof.native(text).getBoundingClientRect().height,
    ),
  ).toBeLessThanOrEqual(TOLERANCE_PX);
});

test.for([9, 12])(
  "renders a mixed paragraph without cumulative font drift at %spt",
  async (fontSizePt, { renderProof }) => {
    const text = "｜漢《かん》waterとoffice、字。".repeat(8);

    const proof = await renderProof(text, { fontSizePt });

    expect(proof.lines.length).toBeGreaterThan(1);
    proof.native("water");
    proof.native("office");
    await recordProof(`genei-paragraph-${fontSizePt}pt`, proof, { fontSizePt, text });
  },
);
