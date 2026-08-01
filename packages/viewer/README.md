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
import { createManuscript } from "@sushichan044/kg-core";
import {
  DiagnosticList,
  ManuscriptProvider,
  ManuscriptViewer,
  SettingsPanel,
  ViewerToolbar,
} from "@sushichan044/kg-viewer";
import "@sushichan044/kg-viewer/styles.css";

const manuscript = createManuscript({ text });

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
File loading, persistence, editor state, drawers, and dialogs stay in the
consuming application.

See [`@sushichan044/kg-core`](../core/README.md) for the framework-independent
pagination, appearance, source mapping, and proofreading APIs.

## Browser support

The package targets browser features that are Baseline Widely Available. It
does not include polyfills.

## License

MIT
