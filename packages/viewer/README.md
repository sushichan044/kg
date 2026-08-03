# @sushichan044/kg-viewer

Controlled React components for rendering composed Japanese manuscripts and
proofreading diagnostics from `@sushichan044/kg-core`.

## Install

```sh
pnpm add @sushichan044/kg-core @sushichan044/kg-viewer react react-dom
```

## React viewer

Import the stylesheet explicitly and pass already processed values:

```tsx
import { DiagnosticList, ManuscriptViewer } from "@sushichan044/kg-viewer";
import "@sushichan044/kg-viewer/styles.css";

<>
  <ManuscriptViewer
    ref={viewRef}
    composed={composed}
    diagnostics={diagnostics}
    activeDiagnosticId={activeDiagnosticId}
    zoom={zoom}
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
scrolling to a page or diagnostic. It reports visible-page and effective-zoom
changes without storing them in the manuscript snapshot.

Ruby, bold, italic, and emphasis annotations render as typed React elements;
annotation content is never inserted as HTML. Overlapping annotations are
rendered deterministically from the normalized annotation set.

Every vertical manuscript line is an independent grid with a half-em gap. The
gap scales with zoom and is included in the core geometry used to center the
grid on the selected paper size.

See [`@sushichan044/kg-core`](../core/README.md) for parsing, composition,
source mapping, schema validation, and proofreading APIs.

## Browser support

The package targets browser features that are Baseline Widely Available. It
does not include polyfills.

## License

MIT
