# @sushichan044/kg-core

Framework-independent TypeScript state and utilities for Japanese manuscript
preview and proofreading.

The package paginates source text into manuscript-grid cells while preserving
UTF-16 source ranges. It also reports common Japanese novel-style diagnostics.
Diagnostics never modify the source text and do not expose automatic fixes. The
default rules also report CJK compatibility ideographs and grapheme clusters
containing Unicode variation selectors, including text/emoji variation
sequences, ideographic variation sequences, and Mongolian free variation
selectors. Ordinary emoji without a variation selector are not reported.

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

`plainTextNotation` is the default. Pass `pixivNotation` to hide supported
pixiv tags and paginate or proofread only their displayed text:

```ts
import {
  DEFAULT_OFFSETS,
  createManuscript,
  paginateManuscript,
  pixivNotation,
  proofreadManuscript,
} from "@sushichan044/kg-core";

paginateManuscript(source, settings, DEFAULT_OFFSETS, pixivNotation);
proofreadManuscript(source, {}, pixivNotation);
createManuscript({ text: source, notation: pixivNotation });
```

Cells and diagnostics still use raw, zero-based UTF-16 source ranges when a
notation hides delimiters or ruby readings. A state's notation is retained by
document updates, but it is a runtime choice and is not encoded in manuscript
preferences.

`decodeManuscriptPreferences` parses only the current versioned persistence
shape. Incompatible or incomplete payloads are rejected; legacy versions are
not migrated.

Diagnostic ranges are zero-based, end-exclusive UTF-16 offsets into the
original source. Pagination normalizes line endings for layout while preserving
those original offsets on every occupied cell.

Appearance settings support A4, A5, A6 (bunko), JIS B5, JIS B6, and shinsho
paper. `calculateManuscriptGeometry` includes the fixed half-em gap between
vertical lines in `gridWidthMm` and exposes its physical size as `lineGapMm`.

## Browser support

The package targets browser features that are Baseline Widely Available. It
does not include polyfills.

## License

MIT
