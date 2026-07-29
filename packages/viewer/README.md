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
import { proofreadManuscript } from "@sushichan044/kg-core";
import { DiagnosticList, ManuscriptViewer } from "@sushichan044/kg-viewer";
import "@sushichan044/kg-viewer/styles.css";

const diagnostics = proofreadManuscript(text);

<ManuscriptViewer
  text={text}
  diagnostics={diagnostics}
  activeDiagnosticId={activeDiagnosticId}
  onDiagnosticSelect={(diagnostic) => {
    setActiveDiagnosticId(diagnostic.id);
    editor.selectRange(diagnostic.range);
  }}
/>;

<DiagnosticList
  diagnostics={diagnostics}
  activeDiagnosticId={activeDiagnosticId}
  onSelect={(diagnostic) => {
    setActiveDiagnosticId(diagnostic.id);
    editor.selectRange(diagnostic.range);
  }}
/>;
```

All React components are controlled. File loading, persistence, editor state,
drawers, and dialogs stay in the consuming application.

See [`@sushichan044/kg-core`](../core/README.md) for the framework-independent
pagination, appearance, source mapping, and proofreading APIs.

## Browser support

The package targets browser features that are Baseline Widely Available. It
does not include polyfills.

## License

MIT
