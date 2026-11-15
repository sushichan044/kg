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

## Compose and proofread with `useManuscript`

`useManuscript` runs the whole pipeline (parse, prepare, compose with the font's
real metrics, proofread) and returns the composed manuscript and diagnostics.
Running it in a Web Worker is the recommended setup.

### Recommended: run in a Web Worker

Composing a long manuscript takes seconds, and on the main thread it blocks
input and rendering for that time. Measured in Chromium with 42k characters and
20 keystrokes at 50 ms intervals, the longest main-thread block was 2685 ms
without a worker and 123 ms with one. Passing `worker` is optional, but use it
whenever your bundler can build a worker. You create the worker, so the package
does not depend on a bundler.

Add a one-line worker file:

```ts
// kg.worker.ts
import "@sushichan044/kg-viewer/worker";
```

Pass `new Worker(...)`, or a function that creates it, to the hook. A function
lets the viewer create a new worker after the previous one died.

```tsx
import { NovelCompositionSettings } from "@sushichan044/kg-core";
import { DiagnosticList, NovelViewer, useManuscript } from "@sushichan044/kg-viewer";

const createWorker = () =>
  new Worker(new URL("./kg.worker.ts", import.meta.url), { type: "module" });

function Preview({ source }: { source: string }) {
  const manuscript = useManuscript({
    source,
    notation: "kakuyomu",
    settings: NovelCompositionSettings.defaults,
    worker: createWorker,
  });
  const { output } = manuscript;
  if (output === null) return <p>Loading...</p>;
  return (
    <>
      <NovelViewer
        composed={output.composed}
        typography={output.typography}
        diagnostics={output.diagnostics}
      />
      <DiagnosticList diagnostics={output.diagnostics} />
    </>
  );
}
```

The worker uses top-level `await` (HarfBuzz), so bundle workers as ES modules.
In Vite, set `worker: { format: "es" }`.

### Fallback: run on the main thread

Omit `worker` when a worker cannot be used, for example when your environment
cannot bundle one. The same hook then composes on the main thread, with the same
result and the same options. Long manuscripts block the main thread while they
compose (see the measurement above).

### Behavior

- While a newer input is pending, `output` keeps the previous composed
  manuscript and diagnostics (`pending` is `true`), so the viewer is never
  suspended or replaced. `output.composed` and
  `output.diagnostics` always come from the same input.
- Only the latest input matters. Inputs that arrive while one is running are
  coalesced, and the stale ones are never computed.
- `failure` describes why the latest input could not be processed (`parse`,
  `compose`, `typography` or `worker`) while `output` keeps the last success.
  A worker that failed to load fails the pending request instead of leaving it
  pending, and `retry()` processes the input again. With a worker factory the
  next request creates a new worker. With a `Worker` instance you own the
  worker and must pass a new one. Replacing the worker processes the latest
  input again.
- `output.proofreadFailure` is set when only proofreading failed. The composed
  manuscript and the other diagnostics are still valid.
- The worker fetches and verifies the font (SHA-256) and shapes text with
  HarfBuzz. The main thread only registers the `FontFace` for rendering.
  Rendering stays DOM (`vertical-rl` spans), so selection, copy and find work as
  before.

The typed RPC between the hook and the worker is bundled into the package and
is not part of its API.

## License

MIT
