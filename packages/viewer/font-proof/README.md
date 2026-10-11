# Real-font proof

Run from the repository root:

```sh
vp install
pnpm --filter @sushichan044/kg-viewer exec playwright install --only-shell chromium webkit
vp run test:font-proof
```

The preparation task requires [uv](https://docs.astral.sh/uv/). The Python script
declares pinned fontTools and uharfbuzz dependencies. It downloads original font
files and their licenses, verifies the font SHA-256 values, and writes a finite
HarfBuzz measurement catalogue to `.cache/`. A repeated preparation uses the
verified cached fonts. Browser tests make no upstream requests.

The catalogue covers the proof corpus, with kerning and standard ligatures both
enabled and disabled. It records glyph IDs and offsets alongside core-compatible
cluster measurements. Code-point cluster indexes are converted to UTF-16 ranges.
The catalogue is an independent numerical reference. GenEi scenarios with normal
features use the production browser measurer; Source Serif and feature-off
controls use the catalogue provider, which rejects requests absent from it.

The two fonts are:

| Font                                                                                          | Original file              | SHA-256                                                            |
| --------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------ |
| [GenEi Koburi Mincho 6.1a](https://okoneya.jp/font/download.html)                             | `GenEiKoburiMin6-R.ttf`    | `c27fb4039ac9fae19152716992b5b9d07558e24f6cccea7b0c1abd0109235166` |
| [Source Serif 4.005 Regular](https://github.com/adobe-fonts/source-serif/releases/tag/4.005R) | `SourceSerif4-Regular.ttf` | `e5a4ee6a3d87bb9024796be390c6771e2a0eb1883dae25effaf57ca01668e24b` |

Both fonts use the SIL Open Font License 1.1. The original copyright notices and
licenses are retained beside the cached files. The fonts are not modified. GenEi is also shipped in the viewer's `assets/`
directory with its license; Source Serif remains test-only.

The fixture registers unique browser font families from verified bytes. It
disables Japanese proportional-width features and vertical kerning, and enables
Western metrics only on sideways runs. It scales measured advances once using
the request's `scale`. Direct production viewer tests exercise the typography
profile without the fixture CSS overrides.

The opt-in `font-proof-browser` project runs in Chromium and WebKit. Normal
`vp test` runs do not include it or require downloaded fonts. Evidence is written
to `.cache/evidence/` with one JSON record and screenshot per recorded case and
browser. JSON records include font identities, HarfBuzz version, browser user
agent, numerical comparisons, and composed line/source placements.

See the [verification report](../../../docs/plans/adr-0007-font-proof/report.md)
for the measured results and embedded application verification.
