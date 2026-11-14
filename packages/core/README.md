# @sushichan044/kg-core

Parse, compose, and proofread Japanese manuscripts without a browser or React.

```sh
pnpm add @sushichan044/kg-core
```

## Parse, compose, and proofread

```ts
import {
  ComposeError,
  composeManuscript,
  NovelCompositionSettings,
  novelComposer,
  ParseError,
  parseManuscript,
  kakuyomuParser,
} from "@sushichan044/kg-core";
import {
  createDefaultProofreadingRules,
  ProofreadError,
  proofreadManuscript,
} from "@sushichan044/kg-core/lint";

const source = "吾輩は猫である。";
const parsed = parseManuscript(source, { parser: kakuyomuParser });
if (!parsed.ok) throw new Error(ParseError.describe(parsed.error));

const composed = composeManuscript(parsed.value, {
  composer: novelComposer,
  settings: NovelCompositionSettings.defaults,
});
if (!composed.ok) throw new Error(ComposeError.describe(composed.error));

const proofread = proofreadManuscript(composed.value, {
  rules: createDefaultProofreadingRules(),
});
if (!proofread.ok) throw new Error(ProofreadError.describe(proofread.error));

const diagnostics = [...parsed.warnings, ...proofread.value];
```

`parseManuscript` defaults to plain text; choose `pixivParser` or
`kakuyomuParser` for platform notation. The resulting layout uses logical font
metrics. For browser font measurements and React previews, use
[`@sushichan044/kg-viewer`](https://github.com/sushichan044/kg/blob/main/packages/viewer/README.md).

## Entry points

- `@sushichan044/kg-core`: parsers, composition, settings, and results.
- `@sushichan044/kg-core/lint`: proofreading with built-in rules.
- `@sushichan044/kg-core/worker/proofread`: proofreading in a Web Worker.
- `@sushichan044/kg-core/plugin`: composition and measurement used by the viewer.

## Other uses

- Read `ParsedManuscript` and its annotations to process text without composing it.
- Use `@sushichan044/kg-core/lint` to run the default proofreading rules.
- Inspect `NovelPage` and `NovelLine` in the composed layout to implement a custom renderer.

### Proofreading in a Web Worker

Long manuscripts take noticeable time to proofread. `@sushichan044/kg-core/worker/proofread`
runs the same rules off the main thread. You create the `Worker` yourself, so
the package does not depend on a particular bundler:

```ts
// proofread.worker.ts
import { defineProofreadingWorker } from "@sushichan044/kg-core/worker/proofread";

defineProofreadingWorker();
```

```ts
import { createProofreadingClient } from "@sushichan044/kg-core/worker/proofread";

const client = createProofreadingClient(
  new Worker(new URL("./proofread.worker.ts", import.meta.url), { type: "module" }),
);

const outcome = await client.proofread(composed, { signal });
if (outcome.ok) show(outcome.value);
```

`outcome` has the same `ManuscriptResult` shape as `proofreadManuscript`. Rules
are functions and cannot cross the worker boundary, so the worker builds them
itself: pass `defineProofreadingWorker({ rules: () => [...] })` to replace the
default set. `proofread` accepts a parsed or a composed manuscript.

Aborting `signal` rejects the returned promise, but a proofreading run that has
already started keeps going. Call `client.terminate()` to stop the worker and
reject every pending call. The client is also `Disposable`, so
`using client = createProofreadingClient(worker)` terminates it at the end of
the scope.

## License

MIT
