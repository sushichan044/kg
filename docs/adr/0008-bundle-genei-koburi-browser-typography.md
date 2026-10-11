# ADR 0008: Bundle GenEi Koburi browser typography

- Status: Accepted
- Date: 2026-10-11
- Extends: ADR 0007

## Decision

Replace the application's existing Mincho choice with the original GenEi Koburi
Mincho 6.1a Regular font. Keep the `mincho` ID and existing storage schemas.
Ship the checksum-pinned, unmodified TTF and its OFL license with the viewer and
embedded application. Source Serif remains a test-only control.

NovelViewer automatically loads and verifies the bundled font for Mincho, waits
for HarfBuzz and the browser face, and recomposes its supplied manuscript with
the same settings before rendering. Gothic keeps its existing composition.
Keep the existing props and settings IDs. The optional typography entry point
returns a synchronous composer and matching viewer resource for callers that
need the measured layout outside the component. A supplied ready resource skips
automatic loading and recomposition. Core's default composer remains logical and
DOM free. Loading failures are Result values; both component and application wait
and offer retry before displaying text.

HarfBuzz shapes complete sideways ASCII runs with standard kerning and ligatures.
Browser-native vertical measurement handles Japanese, upright abbreviations,
ruby, and missing-glyph fallback. Disable `palt`, `vpal`, `halt`, `vhal`, and `vkrn`
in measurement and rendering. Keep the established JLReq box adjustments and
one-em two-digit tate-chu-yoko. Apply ruby scale once.

Optional request styles record weight 400/700 and normal/italic slant. Split
sideways shaping at style boundaries while retaining the original word's
line-breaking identity. The Regular face uses browser-synthesized bold and italic;
drawing boxes describe advances, not ink extents. Preserve exact source positions
and shared ligature positions after splitting.

Missing characters use the same Mincho fallback list in browser measurement and
rendering. Their appearance depends on installed fonts. Font resources own their
probe, face registration, and bounded measurement cache; callers dispose them
when the viewer is no longer used. The automatic component owns and disposes its
resource. Browser font loading and secure-context crypto are requirements of
Mincho typography. Use geometric precision in measurement and drawing to preserve
fractional advances on Linux Chromium.

## Verification

The independent Python HarfBuzz catalogue remains the advance and cluster oracle.
The GenEi proof now exercises the production measurer against this catalogue and
native browser geometry in Chromium and WebKit. Source Serif and feature-off
controls retain their independent test provider. Direct viewer tests verify the
production CSS profile, arbitrary runs, partial styles, tate-chu-yoko, and fallback.
Development and built application checks must both load the packaged WASM asset;
exclude `harfbuzzjs` from Vite dependency prebundling to preserve its asset URL.
