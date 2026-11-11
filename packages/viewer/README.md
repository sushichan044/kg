# @sushichan044/kg-viewer

Controlled React components for rendering composed vertical Japanese novels and
proofreading diagnostics from `@sushichan044/kg-core`. The components take
diagnostics as data, so nothing here depends on
`@sushichan044/kg-core/lint` producing them.

## Install

```sh
pnpm add @sushichan044/kg-core @sushichan044/kg-viewer react react-dom
```

## React viewer

Import a stylesheet explicitly and pass already processed values:

```tsx
import { DiagnosticList, NovelViewer } from "@sushichan044/kg-viewer";

import "@sushichan044/kg-viewer/styles.css";

<>
  <NovelViewer
    ref={viewRef}
    composed={composed}
    diagnostics={diagnostics}
    activeDiagnosticId={activeDiagnosticId}
    showGrid={showGrid}
    zoom={{ value: zoom, min: 50, max: 150, step: 25, onChange: setZoom }}
    onDiagnosticSelect={(diagnostic) => setActiveDiagnosticId(diagnostic.id)}
  />
  <DiagnosticList
    diagnostics={diagnostics}
    activeDiagnosticId={activeDiagnosticId}
    onSelect={(diagnostic) => viewRef.current?.scrollToDiagnostic(diagnostic.id)}
  />
</>;
```

The package performs no parsing, composition, proofreading, persistence, or
settings management. The consuming application owns those operations and
passes immutable snapshots through controlled props.

`NovelViewer` exposes a ref handle for scrolling to a page or diagnostic. It
reports visible-page changes through `onViewEvent` without storing them in the
manuscript snapshot.

`showGrid` defaults to `true`. It controls only the decorative ruling layer;
changing it does not recompose the manuscript, change page geometry, or move
text and ruby.

`spread` defaults to `false`. Set it to `true` to show facing pages.
`startPageSide` accepts `"right"` (the default) or `"left"` and determines
the first page’s position and the mirrored margins. Right starts pair pages
1–2, 3–4; left starts show page 1 alone, followed by pages 2–3, 4–5.
With `fit`, the full spread fits the viewport.

Zoom is controlled by one numeric object. Set `fit` when a whole page should
stay visible. On mount and viewport resize, the viewer calculates the largest
value within `min` and `max`, rounded down from `min` to `step`, then passes it
to `onChange`.

Bold, italic, emphasis, and ruby fragments are rendered from the positions
produced by core. The viewer does not infer annotation boundaries or split ruby
readings. Annotation content is never inserted as HTML.

Page sizes, margins, line gaps, and stage gaps use the millimetre geometry supplied
by core. Body font sizes use Q (1Q = 0.25mm). Zoom scales all physical dimensions
together. Pages alternate inner and outer margins according to `startPageSide`.
The inner margin faces the center of each spread.

Each page shows its one-based page number at the outer edge of the text area,
centered 10mm below the top edge of the paper. The number scales with the page.

See [`@sushichan044/kg-core`](../core/README.md) for parsing, composition,
source mapping, and schema validation, and `@sushichan044/kg-core/lint` for the
proofreading APIs that produce the diagnostics these components render.

## Styling

The components render a fixed DOM whose class names and `data-*` attributes are
the styling contract.

| Entry                                    | Contents                                                   | Required |
| ---------------------------------------- | ---------------------------------------------------------- | -------- |
| `@sushichan044/kg-viewer/structural.css` | Vertical layout and positioned text. No colors.            | Yes      |
| `@sushichan044/kg-viewer/theme.css`      | Default colors, ruling, shadows, and diagnostic treatment. | No       |
| `@sushichan044/kg-viewer/fonts.css`      | `@font-face` rules for the bundled fonts.                  | No       |
| `@sushichan044/kg-viewer/styles.css`     | The fonts and both stylesheets.                            | —        |

Both sheets are unlayered and selected by package class. This protects layout
from low-specificity host resets. Import the package stylesheet before the
application stylesheet and use an equally specific selector for deliberate
overrides.

### DOM contract

```text
div.kgv-viewer
└── div.kgv-viewport
    └── div.kgv-stack
        └── section.kgv-page[data-page-index][data-grid]
            ├── p.kgv-visually-hidden
            ├── span.kgv-folio
            └── div.kgv-page-grid
                └── div.kgv-stage
                    └── div.kgv-line
                        ├── span.kgv-line-rules             ← present when showGrid is true
                        │   └── span.kgv-rule-cell
                        ├── span.kgv-line-text
                        │   └── span.kgv-cell
                        │       └── span.kgv-glyph
                        ├── span.kgv-line-ruby
                        │   └── ruby.kgv-ruby-fragment
                        ├── span.kgv-line-emphasis         ← present when the line carries emphasis
                        │   └── span.kgv-emphasis
                        │       └── span.kgv-emphasis-mark
                        └── span.kgv-line-diagnostics   ← present when the line has diagnostic bands
                            └── span                    ← one wrapper per band
                                ├── span.kgv-diagnostic-band
                                └── button.kgv-diagnostic-trigger   ← only where the diagnostic starts
```

The ruling, text, ruby, emphasis, and diagnostics are independent
absolute-positioned layers. Text positions use core's logical em offsets and
advances. A hanging glyph carries `data-disposition="hanging"`; a source item
suppressed by composition is intentionally absent from visible text. Glyph cells
use `renderSpan`; diagnostic bands use exact or shared source `layoutSpan`
positions. A combined unit is drawn once, without reconstructing `groupRange`
membership. Glue and kern affect the resolved offsets but are not reconstructed
by the viewer.

Ruby and emphasis use core's `AnnotationPlacement` for both inline and block
coordinates. The viewer draws the supplied reading items and mark placements;
it does not choose their anchors, side, count, or offset. The current core style
places half-size decorations on the right of the body while preserving line
pitch. Marks are independent boxes rather than browser `text-emphasis`, so they
do not move the body glyphs. Their half-em inline boxes retain the core-selected
centers. Core handles contextual overhang, compound reading arrangement, and
annotation conflicts before the snapshot reaches this viewer. Update this viewer with the matching core public
contract; the old per-grapheme combination contract has no adapter.

One inert diagnostic band records the range that reaches a line. The default
theme highlights the diagnosed cells themselves. Hovering their text opens
`.kgv-diagnostic-popover`, with every diagnostic affecting that cell. A transparent
`button.kgv-diagnostic-trigger` beside each diagnostic provides keyboard access.
The tooltip contains selectable text and supports Escape dismissal. The body
glyphs use inline boxes so native selection does not insert a line break between
every character.

Touch layouts should expose `DiagnosticList` or an equivalent control rather
than rely on the narrow keyboard triggers. The frontend provides this list from
its diagnostic toolbar button.

State is exposed through these attributes:

| Attribute                   | On                                 | Values                                          |
| --------------------------- | ---------------------------------- | ----------------------------------------------- |
| `data-page-index`           | `.kgv-page`                        | zero-based page number                          |
| `data-grid`                 | `.kgv-page`                        | `visible`, `hidden`                             |
| `data-page-side`            | `.kgv-page`                        | `left`, `right`                                 |
| `data-offscreen`            | `.kgv-page`                        | present on later pages                          |
| `data-disposition`          | `.kgv-cell`                        | `placed`, `hanging`                             |
| `data-presentation`         | `.kgv-cell`                        | `mixed`, `upright`, `sideways`, `tate-chu-yoko` |
| `data-orientation`          | `.kgv-glyph` in a `mixed` cell     | `upright`, `sideways`                           |
| `data-diagnostic`           | `.kgv-cell`                        | present on diagnosed cells                      |
| `data-side`                 | ruby characters and emphasis marks | `before`, `after`                               |
| `data-annotation`           | annotation elements                | annotation kind                                 |
| `data-ruby-fit`             | `.kgv-ruby-fragment`               | `group`, `mono`, `jukugo`                       |
| `data-diagnostic-active`    | cells and diagnostic bands         | present when selected                           |
| `data-diagnostic-severity`  | cells, bands, and diagnostic items | `warning`, `error`                              |
| `data-diagnostic-id`        | `.kgv-diagnostic-band`             | diagnostic ID                                   |
| `data-diagnostic-continued` | continuation diagnostic bands      | present on continuations                        |
| `data-diagnostic-origin`    | `.kgv-diagnostics > li`            | origin kind of the item                         |
| `data-spread`               | `.kgv-stack`                       | present in spread layout                        |
| `data-typography`           | `.kgv-viewer`                      | font preset ID                                  |

`DiagnosticList` renders `ol.kgv-diagnostics > li` with selectable paragraphs
inside `.kgv-diagnostic-message`. When `onSelect` is supplied, a separate
`button.kgv-diagnostic-jump` navigates to the manuscript. An empty list renders
`p.kgv-diagnostics-empty` only when `emptyMessage` is supplied.

### Custom properties

`NovelViewer` sets `--kgv-cell-size`, `--kgv-line-gap`, `--kgv-stage-gap`,
`--kgv-line-length`, `--kgv-page-width`, `--kgv-page-height`, `--kgv-margin-top`,
`--kgv-margin-bottom`, `--kgv-margin-inner`, `--kgv-margin-outer`,
`--kgv-manuscript-font`, `--kgv-font-features`, `--kgv-western-kerning`,
`--kgv-font-synthesis`, and `--kgv-folio-top` on `.kgv-stack`. Cells and
diagnostic bands also carry per-element `--kgv-item-offset`, `--kgv-item-advance`,
`--kgv-band-lane`, `--kgv-band-lanes`, `--kgv-band-length`, and `--kgv-band-offset`.
Read the stack-level properties to align custom decorations;
do not replace them because fit zoom and positioned text depend on them.

The optional theme exposes `--kgv-surface`, `--kgv-paper`, `--kgv-text`,
`--kgv-text-muted`, `--kgv-grid`, `--kgv-rule-width`, `--kgv-accent`,
`--kgv-marker` (diagnostic tint), `--kgv-focus` (keyboard focus),
`--kgv-controls-surface`, and `--kgv-padding`.

## Browser support

The layout targets browser features that are Baseline Widely Available.
Diagnostic tooltips use Base UI for hover behavior, positioning, and dismissal.
Their portal stays inside the viewer root to inherit custom theme properties.
Applications must provide compatible `react` and `react-dom` versions.

## License

MIT

## Font resources and measured composition

The `mincho` preset selects bundled Rin Mincho Regular and Bold. `genei-koburi`
selects GenEi Koburi Mincho Regular; `gothic` uses logical system-font metrics.
Existing `mincho` preferences keep their ID. Font files are unmodified and ship
with their OFL notices in `assets`.

A manuscript is composed with the measurer for its font preset, then rendered.
`NovelViewer` only renders `composed`; it never loads fonts. The browser draws
the bundled fonts from `fonts.css` (included in `styles.css`), whose
`@font-face` rules point at the same files the measurer reads. Applications that
import only `structural.css` import `fonts.css` as well.

```tsx
import { composeManuscript } from "@sushichan044/kg-core";
import { NovelViewer, useFontMeasurer } from "@sushichan044/kg-viewer";
import { Suspense } from "react";

import "@sushichan044/kg-viewer/styles.css";

function Preview({ parsed, settings }) {
  const state = useFontMeasurer(settings.appearance.fontPreset);
  if (state.kind === "failed")
    return (
      <div role="alert">
        <p>Font failed to load ({state.error.kind}).</p>
        <button type="button" onClick={state.retry}>
          Retry
        </button>
      </div>
    );
  const prepared = state.measurer.prepare(parsed);
  const composed = composeManuscript(prepared.parsed, {
    composer: state.measurer.composer,
    settings,
  });
  if (!composed.ok) return null;
  // Map parser warnings and proofreading ranges with prepared.mapRange.
  return <NovelViewer composed={composed.value} />;
}

<Suspense fallback={<p role="status">Loading font…</p>}>
  <Preview parsed={parsed} settings={settings} />
</Suspense>;
```

`useFontMeasurer(fontPreset)` suspends until the measurer is ready, then returns
`{ kind: "ready", measurer }` or `{ kind: "failed", error, retry }`. The package
ships no status components. Loaded measurers are shared by every component for
the lifetime of the page, so a preset that was loaded before is returned without
suspending, and changing the preset inside a transition (for example with
`useDeferredValue`) keeps the previous preview on screen until the new font is
ready. `retry` reloads a failed preset in a transition; after a `shaper-load`
failure it reloads the page. `resetFontMeasurers()` drops the shared measurers;
tests call it to keep font requests independent, and applications can call it to
release fonts they no longer use. `gothic` resolves immediately and fetches
nothing.

The measurer reads the font files with HarfBuzz and needs no DOM, so it also runs
in Node or a worker through `@sushichan044/kg-viewer/measure`:

```ts
import { readFile } from "node:fs/promises";

import { createFontMeasurer } from "@sushichan044/kg-viewer/measure";

const font = (file: string) =>
  readFile(new URL(import.meta.resolve(`@sushichan044/kg-viewer/fonts/${file}`)));
const loaded = await createFontMeasurer({
  fontPreset: "mincho",
  faces: { 400: await font("RinMincho-Regular.ttf"), 700: await font("RinMincho-Bold.ttf") },
});
```

`loadFontMeasurer({ fontPreset, fontUrls? })` fetches the bundled files instead.
Font bytes are checksum verified; loading, integrity and shaper failures have
separate Result error kinds (`FontMeasurerLoadError`). `fontUrls` can override the
URLs by weight without changing the expected bytes. Vite consumers exclude
`@sushichan044/kg-viewer` and `harfbuzzjs` from dependency prebundling so font and
WASM URLs resolve to deployable assets.

Glyphs a font lacks are measured with the logical width rules and drawn by the
browser's fallback font, which may overflow the measured box. Capture libraries
that embed fonts (for example SnapDOM's `localFonts`) can use the font file URLs
exported as `@sushichan044/kg-viewer/fonts/*.ttf`.

### Migrating from 0.x typography resources

- Replace `TypographyProvider` and `useTypography` with `useFontMeasurer`. The
  ready state carries `measurer` instead of `typography`; there is nothing to
  dispose and no provider.
- Remove the `typography` prop from `NovelViewer` and compose with
  `measurer.composer` before rendering. `NovelViewer` no longer loads fonts for a
  bare `composed`, and no longer renders loading or mismatch messages.
- Replace `loadTypography` from `@sushichan044/kg-viewer/typography` with
  `loadFontMeasurer` or `createFontMeasurer` from `@sushichan044/kg-viewer/measure`.
  `TypographyLoadError` is now `FontMeasurerLoadError`.
- Import `fonts.css` (or `styles.css`) for the bundled fonts. `fontFaces` blob URLs
  are gone; use the `fonts/*.ttf` exports.

The independent font proof runs with `vp run test:font-proof`. It compares browser
geometry with Python HarfBuzz metrics for GenEi and both Rin faces, including
ligatures, weight changes, combined kana, ruby and source coordinates in Chromium
and WebKit. Generated evidence stays in the ignored `font-proof/.cache` directory.
