# @sushichan044/kg-viewer

Reusable React components for previewing Japanese prose on a manuscript grid
and displaying proofreading diagnostics produced by
`@sushichan044/kg-core`.

## Install

```sh
pnpm add @sushichan044/kg-core @sushichan044/kg-viewer react react-dom
```

## React viewer

Import the stylesheet explicitly:

```tsx
import { createManuscript, pixivNotation } from "@sushichan044/kg-core";
import {
  DiagnosticList,
  ManuscriptProvider,
  ManuscriptViewer,
  SettingsPanel,
  ViewerToolbar,
} from "@sushichan044/kg-viewer";
import "@sushichan044/kg-viewer/styles.css";

const manuscript = createManuscript({ text, notation: pixivNotation });

<ManuscriptProvider controller={manuscript}>
  <ViewerToolbar documentLabel="draft.txt" onDiagnosticsOpen={openDiagnostics} />
  <ManuscriptViewer onDiagnosticSelect={(diagnostic) => editor.selectRange(diagnostic.range)} />
  <DiagnosticList onSelect={(diagnostic) => editor.selectRange(diagnostic.range)} />
  <SettingsPanel />
</ManuscriptProvider>;
```

The provider connects the controller to the packaged viewport, toolbar,
diagnostics, zoom, and settings components. `ManuscriptViewer` also exposes a
ref handle for DOM-only operations such as scrolling to a page or diagnostic.
When a diagnostic covers a variation sequence, its complete grapheme cluster is
kept in one manuscript cell and highlighted as one diagnostic range.
File loading, persistence, editor state, drawers, and dialogs stay in the
consuming application.

With `pixivNotation`, ruby, bold, italic, and emphasis tags are omitted from the
manuscript text and rendered as typed React elements. The viewer never inserts
notation content as HTML.

Every vertical manuscript line is rendered as an independent grid with a
half-em gap. The gap scales with the viewer zoom and is included in the core
geometry used to center the grid on the selected paper size.

See [`@sushichan044/kg-core`](../core/README.md) for the framework-independent
pagination, appearance, source mapping, and proofreading APIs.

## Browser support

The package targets browser features that are Baseline Widely Available. It
does not include polyfills.

## License

MIT
