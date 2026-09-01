# @sushichan044/kg-viewer

Controlled React components for rendering composed vertical Japanese novels and
proofreading diagnostics from `@sushichan044/kg-core`.

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

Zoom is controlled by one numeric object. Set `fit` when a whole page should
stay visible. On mount and viewport resize, the viewer calculates the largest
value within `min` and `max`, rounded down from `min` to `step`, then passes it
to `onChange`.

Bold, italic, emphasis, and ruby fragments are rendered from the positions
produced by core. The viewer does not infer annotation boundaries or split ruby
readings. Annotation content is never inserted as HTML.

See [`@sushichan044/kg-core`](../core/README.md) for parsing, composition,
source mapping, schema validation, and proofreading APIs.

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
                        └── span.kgv-line-diagnostics
                            └── button|span.kgv-diagnostic-band
```

The ruling, text, ruby, and diagnostics are independent absolute-positioned
layers. Text positions use core's logical em offsets and advances. A hanging
glyph carries `data-disposition="hanging"`; a source item suppressed by composition
is intentionally absent from visible text. Glyph cells use `renderSpan`, while ruby
and diagnostic bands use the typographic `layoutSpan`. Glue and kern affect the
resolved offsets but are not reconstructed by the viewer.

One diagnostic band covers the range that reaches a line. Identical ranges are
split into lanes so each remains visible and clickable. The band where a
diagnostic begins is a button; continuation bands are inert spans.

State is exposed through these attributes:

| Attribute                   | On                                 | Values                         |
| --------------------------- | ---------------------------------- | ------------------------------ |
| `data-page-index`           | `.kgv-page`                        | zero-based page number         |
| `data-grid`                 | `.kgv-page`                        | `visible`, `hidden`            |
| `data-overflow`             | `.kgv-page`                        | present when content overflows |
| `data-offscreen`            | `.kgv-page`                        | present on later pages         |
| `data-disposition`          | `.kgv-cell`                        | `placed`, `hanging`            |
| `data-annotation`           | annotation elements                | annotation kind                |
| `data-ruby-fit`             | `.kgv-ruby-fragment`               | `group`, `mono`, `jukugo`      |
| `data-diagnostic-active`    | cells and diagnostic bands         | present when selected          |
| `data-diagnostic-severity`  | cells, bands, and diagnostic items | `warning`, `error`             |
| `data-diagnostic-id`        | `.kgv-diagnostic-band`             | diagnostic ID                  |
| `data-diagnostic-continued` | continuation diagnostic bands      | present on continuations       |

`DiagnosticList` renders `ol.kgv-diagnostics > li > button`, or
`p.kgv-diagnostics-empty` when there are no diagnostics.

### Custom properties

`NovelViewer` sets `--kgv-cell-size`, `--kgv-line-gap`,
`--kgv-line-length`, `--kgv-page-width`, `--kgv-page-height`, and
`--kgv-manuscript-font` on `.kgv-stack`. Read them to align custom decorations;
do not replace them because fit zoom and positioned text depend on them.

The optional theme exposes `--kgv-surface`, `--kgv-paper`, `--kgv-text`,
`--kgv-text-muted`, `--kgv-grid`, `--kgv-rule-width`, `--kgv-accent`,
`--kgv-controls-surface`, and `--kgv-padding`.

## Browser support

The package targets browser features that are Baseline Widely Available. It
does not include polyfills.

## License

MIT
