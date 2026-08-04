# @sushichan044/kg-viewer

Controlled React components for rendering composed Japanese manuscripts and
proofreading diagnostics from `@sushichan044/kg-core`.

## Install

```sh
pnpm add @sushichan044/kg-core @sushichan044/kg-viewer react react-dom
```

## React viewer

Import a stylesheet explicitly and pass already processed values:

```tsx
import { DiagnosticList, ManuscriptViewer } from "@sushichan044/kg-viewer";
import "@sushichan044/kg-viewer/styles.css";

<>
  <ManuscriptViewer
    ref={viewRef}
    composed={composed}
    diagnostics={diagnostics}
    activeDiagnosticId={activeDiagnosticId}
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

`ManuscriptViewer` exposes a ref handle for DOM-only navigation, including
scrolling to a page or diagnostic. It reports visible-page changes through
`onViewEvent` without storing them in the manuscript snapshot.

Zoom is controlled by one numeric object. The viewer always renders `value`; it
does not prescribe a toolbar or any appearance for one. Set `fit` when a whole
page should stay visible: on mount and viewport resize, the viewer calculates the
largest value within `min` and `max`, rounded down from `min` to `step`, then
passes it to `onChange`.

```tsx
const [zoom, setZoom] = useState(100);
const [fit, setFit] = useState(true);

<ManuscriptViewer
  composed={composed}
  zoom={{ value: zoom, min: 50, max: 150, step: 25, onChange: setZoom }}
  fit={fit}
/>;
```

An application may use the same values for any UI it prefers. For example, a
manual zoom button can call `setFit(false)` and then `setZoom(zoom + 25)`; a
separate "fit page" button can call `setFit(true)`.

Bold, italic, and emphasis annotations render as typed React elements;
annotation content is never inserted as HTML. Overlapping annotations are
rendered deterministically from the normalized annotation set.

A ruby annotation keeps its `<ruby>` and `<rt>`, but the reading is placed by
`span.kgv-ruby` inside the `<rt>`, one box per character: engines lay ruby text out
themselves and disagree about how much of that a stylesheet may take over, while
they all treat a plain span as a plain span. Style `.kgv-ruby` rather than `rt`.

`data-ruby-fit` says how the reading relates to its base: `mono` when there is one
reading character per base character, so each sits on the character it belongs to,
and `group` otherwise, so the reading spreads across the compound with its first
and last character at either end.

Every vertical manuscript line is an independent grid with a half-em gap. The
gap scales with zoom and is included in the core geometry used to center the
grid on the selected paper size.

See [`@sushichan044/kg-core`](../core/README.md) for parsing, composition,
source mapping, schema validation, and proofreading APIs.

## Styling

The components ship no look of their own. They render a fixed DOM whose class
names and `data-*` attributes are the public styling contract, so applications
style them with ordinary CSS instead of props.

### Stylesheets

| Entry                                    | Contents                                                | Required |
| ---------------------------------------- | ------------------------------------------------------- | -------- |
| `@sushichan044/kg-viewer/structural.css` | Layout physics of the vertical-writing grid. No colors. | Yes      |
| `@sushichan044/kg-viewer/theme.css`      | The default look: colors, borders, shadows, spacing.    | No       |
| `@sushichan044/kg-viewer/styles.css`     | Both of the above.                                      | —        |

`structural.css` is required because the grid is laid out from geometry that
only CSS can consume — cell pitch, line gap, and page size arrive as custom
properties and are resolved with `calc()`. Import it and style everything else
yourself, or import `styles.css` and adjust the tokens below.

Both sheets are **unlayered and selected by package class**. This makes the
layout and default theme independent of low-specificity reset styles such as
Tailwind Preflight and classic universal or element resets, even when the reset
is loaded later. The package does not apply a global `*` reset of its own.

Import the package stylesheet before your application stylesheet. Override a
rule deliberately with an equally specific package-class selector loaded after
it. Rules using `!important`, or selectors with class, attribute, or ID
specificity, are treated as intentional application customization rather than
as resets and are outside this compatibility guarantee.

`structural.css` also neutralizes the inherited text properties that would
distort a fixed-size cell (`letter-spacing`, `word-spacing`, `text-indent`,
`text-transform`, font weight, and font style), since inheritance reaches the
glyphs regardless of specificity. It fixes the box model of sized elements and
keeps semantic bold and italic annotations intact without the optional theme.
Browser suites render the viewer directly and through `IframeIsolation` under
host resets to keep this contract from regressing.

### DOM contract

```text
div.kgv-viewer
└── div.kgv-viewport
    └── div.kgv-stack                       ← carries the geometry properties
        └── section.kgv-page[data-page-index]
            ├── p.kgv-visually-hidden       ← page text for assistive tech
            └── div.kgv-page-grid
                └── div.kgv-stage
                    └── div.kgv-line
                        ├── span.kgv-annotation-stack     ← only around annotated runs
                        │   └── strong|em|ruby|span.kgv-annotation
                        │       └── rt                    ← ruby only
                        │           └── span.kgv-ruby
                        │               └── span.kgv-ruby-character
                        └── span.kgv-cell
                            ├── span.kgv-glyph
                            └── button.kgv-diagnostic-marker  ← only where a diagnostic starts
```

`DiagnosticList` renders `ol.kgv-diagnostics > li > button`, with
`span.kgv-diagnostic-location` inside each button, or
`p.kgv-diagnostics-empty` when there is nothing to report.

State is exposed as attributes rather than modifier classes:

| Attribute                  | On                        | Values                                          |
| -------------------------- | ------------------------- | ----------------------------------------------- |
| `data-page-index`          | `.kgv-page`               | zero-based page number                          |
| `data-overflow`            | `.kgv-page`               | present when the grid exceeds the paper         |
| `data-offscreen`           | `.kgv-page`               | present on pages eligible for skipped rendering |
| `data-annotation`          | `.kgv-annotation`         | `bold`, `italic`, `ruby`, `emphasis`            |
| `data-ruby-fit`            | `.kgv-annotation`         | `mono`, `group`                                 |
| `data-diagnostic`          | `.kgv-cell`               | present when a diagnostic covers the cell       |
| `data-diagnostic-active`   | `.kgv-cell`               | present when that diagnostic is selected        |
| `data-diagnostic-severity` | `.kgv-cell`, `li`         | `warning`, `error`                              |
| `data-diagnostic-origin`   | `li`                      | `parser`, `rule`                                |
| `data-diagnostic-id`       | `.kgv-diagnostic-marker`  | id of the diagnostic the marker stands for      |
| `aria-current`             | `.kgv-diagnostics button` | `true` on the selected item                     |

`data-diagnostic-id` is what makes the markers addressable without a callback per
interaction: look the id up in the `diagnostics` you passed in to drive a hover
tooltip, a deep link, or an assertion. The marker's `aria-label` already carries
the position and message for assistive technology.

Emphasis marks are the one exception: the mark character is per-instance data,
so it is set as an inline `text-emphasis` style and cannot be themed in CSS.

### Custom properties

`theme.css` declares these on `.kgv-viewer`; override them to retint the
default look. `DiagnosticList` reads them with literal fallbacks, so it also
works when rendered outside `.kgv-viewer`.

`--kgv-surface`, `--kgv-paper`, `--kgv-text`, `--kgv-text-muted`, `--kgv-grid`,
`--kgv-accent`, `--kgv-controls-surface`, `--kgv-padding`.

`ManuscriptViewer` sets `--kgv-cell-size`, `--kgv-line-gap`, `--kgv-page-width`,
`--kgv-page-height`, and `--kgv-manuscript-font` on `.kgv-stack` from the
composed geometry and the effective zoom. Read them to stay aligned with the
grid; do not assign them, since the layout and the fit-zoom measurement depend
on the values the component computes.

### Isolated rendering

`IframeIsolation` renders children into an iframe built from `srcDoc`, giving
them a document of their own that the host page's stylesheets do not reach. The
iframe is deliberately not sandboxed: it stays same-origin so the component can
portal React children into it. It injects `structural.css` and nothing else by
default:

```tsx
import { IframeIsolation, ManuscriptViewer, themeStyles } from "@sushichan044/kg-viewer";

<IframeIsolation styles={{ kind: "structural", css: themeStyles }}>
  <ManuscriptViewer composed={composed} />
</IframeIsolation>;
```

`styles` accepts `{ kind: "structural", css? }` to append CSS after the
structural rules, or `{ kind: "custom", css }` to supply every rule yourself.
`structuralStyles` and `themeStyles` are also exported as plain strings for
shadow roots and server-rendered `<style>` tags.

Applications that own the whole page usually do not need this component:
render `ManuscriptViewer` directly so the page's own cascade reaches it.

`DiagnosticList` is a convenience, not infrastructure. Building your own list
from `ManuscriptDiagnostic[]` is expected when you want different markup.

## Browser support

The package targets browser features that are Baseline Widely Available. It
does not include polyfills.

## License

MIT
