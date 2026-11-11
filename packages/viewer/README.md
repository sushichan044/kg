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

## PNG export

`@sushichan044/kg-viewer/worker/export` turns a rendered `NovelViewer` into a zip of
600 dpi, one-bit PNG pages. Pages are drawn on the main thread (the browser has
to render them), while PNG encoding and zip packing run in a Web Worker so the
page stays responsive. You create the `Worker`, so the package does not depend
on a particular bundler:

```ts
// export.worker.ts
import { definePageEncoderWorker } from "@sushichan044/kg-viewer/worker/export-encoder";

definePageEncoderWorker();
```

```ts
import { exportPages } from "@sushichan044/kg-viewer/worker/export";

const zip = await exportPages({
  host, // an element that contains a rendered NovelViewer
  composed,
  typography,
  createWorker: () =>
    new Worker(new URL("./export.worker.ts", import.meta.url), { type: "module" }),
  signal,
});
```

`exportPages` reads the `.kgv-page` elements inside `host`, so render a
`NovelViewer` for the same `composed` manuscript there. It creates one worker
per call and stops it when the export finishes or `signal` aborts. Saving the
returned bytes is up to the application.

The entry points are named `worker/*` because each one belongs to a Web Worker
job. `exportPages` binds its worker with `using`, so the worker stops on every
exit path.

## Styling

The components render a fixed DOM whose class names and `data-*` attributes are
the styling contract.

| Entry                                    | Contents                                                   | Required |
| ---------------------------------------- | ---------------------------------------------------------- | -------- |
| `@sushichan044/kg-viewer/structural.css` | Vertical layout and positioned text. No colors.            | Yes      |
| `@sushichan044/kg-viewer/theme.css`      | Default colors, ruling, shadows, and diagnostic treatment. | No       |
| `@sushichan044/kg-viewer/styles.css`     | Both stylesheets.                                          | —        |

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
| `data-typography`           | `.kgv-viewer`                      | selected typography font ID                     |

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

`NovelViewer` prepares the selected browser font automatically when no `typography`
resource is supplied. Applications displaying page counts or proofreading outside
the viewer should load a resource first and share its prepared composition:

```tsx
import { composeManuscript, NovelCompositionSettings } from "@sushichan044/kg-core";
import { loadTypography } from "@sushichan044/kg-viewer/typography";

const loaded = await loadTypography({ fontPreset: "mincho" });
if (!loaded.ok) return;
const typography = loaded.value;
const prepared = typography.prepare(parsed);
const composed = composeManuscript(prepared.parsed, {
  composer: typography.composer,
  settings: NovelCompositionSettings.defaults,
});
// Run proofreading on composed.value and map parser warnings with prepared.mapRange.
// Pass the same typography to NovelViewer; dispose it when the owner unmounts.
```

React consumers load fonts through `TypographyProvider` and `useTypography(fontPreset)`:

```tsx
import { NovelViewer, TypographyProvider, useTypography } from "@sushichan044/kg-viewer";
import { Suspense } from "react";

function Preview({ composed }) {
  const state = useTypography(composed.settings.appearance.fontPreset);
  if (state.kind === "failed")
    return (
      <div role="alert">
        <p>Font failed to load ({state.error.kind}).</p>
        <button type="button" onClick={state.retry}>
          Retry
        </button>
      </div>
    );
  return <NovelViewer composed={composed} typography={state.typography} />;
}

<TypographyProvider>
  <Suspense fallback={<p role="status">Loading font…</p>}>
    <Preview composed={composed} />
  </Suspense>
</TypographyProvider>;
```

The package ships no status components: the consumer renders the Suspense
fallback and the failure UI from `state.error` and `state.retry`.

`useTypography` suspends until the font is ready, then returns
`{ kind: "ready", typography }` or `{ kind: "failed", error, retry }`. It throws
when no `TypographyProvider` is above it. Place the provider above the Suspense
boundary; a provider inside the boundary loses its cache each time it suspends.
The provider caches every loaded preset and disposes all of them when it unmounts,
including loads that finish later. A preset that was loaded before is returned
without suspending, so changing the preset inside a transition (for example with
`useDeferredValue`) keeps the previous preview on screen until the new font is ready.
`retry` reloads a failed preset in a transition; after a `shaper-load` failure it
reloads the page.

Without a `typography` prop, `NovelViewer` suspends inside its own boundary and
shows built-in Japanese messages: a loading message while the font loads and a
retry control when it fails. It uses an enclosing `TypographyProvider` when one
exists; otherwise it owns a cache that it replaces when the font preset changes.
A supplied resource whose ID differs from the composition settings is rejected.

The loader shares OpenType features and actual face weights between HarfBuzz
Western shaping, native vertical measurement and drawing. Measurements use Q
(1Q = 0.25mm). Font files are checksum verified; loading, integrity and shaper
failures have separate Result error kinds. `fontUrls` can override the URLs by
weight without changing the expected bytes. Vite consumers exclude `@sushichan044/kg-viewer` and `harfbuzzjs`
from dependency prebundling so font and WASM URLs resolve to deployable assets.

`ReadyTypography.fontFaces` exposes blob URLs for the verified font bytes, with
family, weight and style. Pass these to a capture library's explicit font input
(for example SnapDOM's `localFonts`) to embed the same faces in exported images.
These URLs are valid until `dispose()`; do not retain them after disposal.

Callers migrating from the GenEi draft API use
`loadTypography({ fontPreset: "genei-koburi", fontUrls: { 400: fontUrl } })`,
prepare the parsed manuscript, and retain the existing composer/measurer/dispose
workflow. Settings must select the same `genei-koburi` ID.

The independent font proof runs with `vp run test:font-proof`. It compares browser
geometry with Python HarfBuzz metrics for GenEi and both Rin faces, including
ligatures, weight changes, combined kana, ruby and source coordinates in Chromium
and WebKit. Generated evidence stays in the ignored `font-proof/.cache` directory.
