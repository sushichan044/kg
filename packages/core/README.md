# @sushichan044/kg-core

Framework-independent TypeScript state and utilities for Japanese manuscript
preview and proofreading.

The package paginates source text into manuscript-grid cells while preserving
UTF-16 source ranges. It also reports common Japanese novel-style diagnostics.
Diagnostics never modify the source text and do not expose automatic fixes.

## Install

```sh
pnpm add @sushichan044/kg-core
```

## Usage

```ts
import { paginateManuscript, proofreadManuscript } from "@sushichan044/kg-core";

const pagination = paginateManuscript(source, {
  charsPerLine: 27,
  linesPerStage: 23,
  stagesPerPage: 2,
});

const diagnostics = proofreadManuscript(source);
```

For an interactive viewer or editor, use the immutable manuscript state and
transaction API. Pagination, geometry, and diagnostics are derived together
from each accepted snapshot.

```ts
import { createManuscript } from "@sushichan044/kg-core";

const manuscript = createManuscript({ text: source });

manuscript.subscribe((transaction) => {
  render(transaction.state);
});

manuscript.dispatch(
  { type: "document.replace", text: nextSource },
  { type: "config.patch", patch: { settings: { charsPerLine: 30 } } },
);
```

`decodeManuscriptPreferences` parses only the current versioned persistence
shape. Incompatible or incomplete payloads are rejected; legacy versions are
not migrated.

Diagnostic ranges are zero-based, end-exclusive UTF-16 offsets into the
original source. Pagination normalizes line endings for layout while preserving
those original offsets on every occupied cell.

## Browser support

The package targets browser features that are Baseline Widely Available. It
does not include polyfills.

## License

MIT
