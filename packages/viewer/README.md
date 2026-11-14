# @sushichan044/kg-viewer

React components for displaying vertical manuscripts composed with
[`@sushichan044/kg-core`](https://github.com/sushichan044/kg/blob/main/packages/core/README.md).

```sh
pnpm add @sushichan044/kg-core @sushichan044/kg-viewer react react-dom
```

## Display a manuscript

Pass a composed manuscript and optional diagnostics to the controlled viewer:

```tsx
import type { NovelComposedManuscript } from "@sushichan044/kg-core";
import { NovelViewer } from "@sushichan044/kg-viewer";

import "@sushichan044/kg-viewer/styles.css";

function Preview({ composed }: { composed: NovelComposedManuscript }) {
  return <NovelViewer composed={composed} />;
}
```

`NovelViewer` loads its font automatically when no `typography` is supplied.
For page counts or image export that must use the same font measurements, use
`TypographyProvider` and `useTypography` in React.

Use `NovelViewerProps` or `DiagnosticListProps` when wrapping the components.
Import `styles.css` for layout and the default theme.

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

## License

MIT
