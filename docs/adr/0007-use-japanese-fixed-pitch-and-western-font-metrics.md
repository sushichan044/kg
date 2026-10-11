# ADR 0007: Use Japanese fixed pitch and Western font metrics

- Status: Accepted
- Date: 2026-10-10
- Extends: ADR 0006
- Verification: [Real-font proof](../plans/adr-0007-font-proof/report.md)

## Context

ADR 0006 separates measurement, JLReq admissibility rules, book style, and
paragraph layout. Its `RunMeasurer` accepts aggregate advances or authoritative
cluster mappings. The default provider supplies deterministic logical em metrics;
it does not inspect a font.

The composer currently combines a measured sideways run only when a cluster
contains multiple graphemes. A provider can also return one cluster per grapheme
after applying proportional advances and pair kerning. Drawing those members
separately loses the shaping context, although their layout positions are valid.

Japanese fixed-pitch composition with Western metrics corresponds to InDesign's
[Japanese fixed-width kerning setting](https://blog.adobe.com/jp/publish/2019/07/22/cc-indesign-basics-05-kerning).
Japanese letter faces remain inside their normal frames. Western text uses the
font's advances and pair adjustments. Letter-face bounding boxes do not define
either kind of advance.

## Decision

Keep Japanese body text at its existing fixed pitch and retain the JLReq rules
for punctuation, Japanese/Western boundaries, authored spaces, and line adjustment.
Do not introduce optical face fitting, numeric tracking controls, or selectable
kerning policies.

Treat every clustered sideways run as one rendering unit, including runs whose
clusters each cover one grapheme. Preserve `exact` source placements for those
clusters and `shared` placements for ligatures. Rendering combination does not
merge measurement clusters or invent caret positions inside a ligature.

Use the provider's clustered advances before paragraph candidate fitting and
scoring. Font kerning belongs to the run's natural width; it is not an additional
JLReq boundary glue or another line-adjustment capacity. The existing run interior
remains protected from line breaks and generated pair spacing. Oversized runs
retain the existing forced-overflow behavior.

For newly combined runs with one-grapheme clusters, preserve separate rendering
when a bold or italic annotation covers only part of the run. The current
whole-run renderer cannot express a style transition without reshaping. This
change does not expand the previous multi-grapheme-cluster style contract.

Reuse the existing public request, measurement, render-unit, and source-placement
types. An `advance` result still supplies no cluster positions, so it retains
per-grapheme placement and rendering. Keep `logicalRunMeasurer` as the default.
Run recognition, upright abbreviations, and tate-chu-yoko behavior are unchanged.

## Provider and renderer agreement

A real provider must be ready before synchronous composition begins. It must
shape the complete Western run with the same font bytes, size, orientation, and
OpenType features that the renderer uses. Horizontal shaping advances are used
along the inline axis of a sideways run; vertical Japanese advances remain fixed
pitch. Provider values are body em and apply request `scale` exactly once.

Providers include proportional Western widths, pair kerning, and supported
ligatures in the measured run. They exclude JLReq punctuation box adjustments,
pair spacing, indentation, hanging, and ruby expansion. `renderSpan` describes
the drawing box; it is not an ink bounding box. Font glyph IDs and shaping offsets
can be retained by a provider for verification without adding them to core's
public contract.

A missing kerning table legitimately produces no pair adjustment. No adjustment
is synthesized from outlines or from differences between unrelated font widths.
Unsupported provider mappings continue to fail at the measurement boundary.

## Real-font verification

The opt-in proof uses original, checksum-pinned GenEi Koburi Mincho 6.1a and
Source Serif 4.005 Regular fonts. A development-only HarfBuzz preparation script
records actual advances, clusters, and glyph data. Browser tests load those same
font bytes and compare the viewer's glyph elements with unconstrained native
text using identical orientation and features. Chromium and WebKit check 9pt
and 12pt with a 0.25 CSS-pixel geometry tolerance.

GenEi verifies Japanese one-em pitch, variable Western widths, `ffi` ligatures,
vertical punctuation, and combining dakuten. Its absence of standard Western
pair kerning is a tested result. Source Serif verifies an actual `Wave` pair
adjustment. Additional cases cover changed paragraph breaks, oversized runs,
ruby, source placements, and diagnostic bands. The proof records numerical
results and screenshots and runs in CI.

## Consequences

Core can consume real metrics through its existing plugin contract without
adding user settings or persistence migrations. The default application continues
to use logical metrics until production font management is implemented.

The proof's font loading, CSS overrides, and measurement catalogue are test-only.
They do not add a font preset, ship fonts in npm packages, or establish general
browser-font discovery and fallback support. Production font selection, loading,
style-aware shaping, and font fallback remain later work. That implementation
must preserve the measured-font and rendered-font agreement demonstrated here.
