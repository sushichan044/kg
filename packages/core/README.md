# @sushichan044/kg-core

Framework-independent TypeScript utilities for Japanese manuscript preview and
proofreading.

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

Diagnostic ranges are zero-based, end-exclusive UTF-16 offsets into the
original source. Pagination normalizes line endings for layout while preserving
those original offsets on every occupied cell.

## Browser support

The package targets browser features that are Baseline Widely Available. It
does not include polyfills.

## License

MIT
