# @sushichan044/kg-core

Framework-independent parsing, composition, and proofreading for Japanese
manuscripts.

The package exposes plain readonly data transfer objects and pure processing
functions. It does not own application state, persistence, React components,
or DOM behavior.

## Install

```sh
pnpm add @sushichan044/kg-core
```

## Processing pipeline

```ts
import {
  ComposeError,
  composeManuscript,
  createDefaultProofreadingRules,
  ManuscriptCompositionSettings,
  manuscriptGridComposer,
  ParseError,
  parseManuscript,
  kakuyomuParser,
  pixivParser,
  ProofreadError,
  proofreadManuscript,
} from "@sushichan044/kg-core";

const parsed = parseManuscript(source, { parser: kakuyomuParser });
if (!parsed.ok) throw new Error(ParseError.describe(parsed.error));

const composed = composeManuscript(parsed.value, {
  composer: manuscriptGridComposer,
  settings: ManuscriptCompositionSettings.defaults,
});
if (!composed.ok) throw new Error(ComposeError.describe(composed.error));

const proofread = proofreadManuscript(composed.value, {
  rules: createDefaultProofreadingRules(),
});
if (!proofread.ok) throw new Error(ProofreadError.describe(proofread.error));

const diagnostics = [...parsed.warnings, ...proofread.value];
```

`parseManuscript` uses `plainTextParser` when no parser is supplied. The built-in
`pixivParser` normalizes ruby, bold, italic, and emphasis notation; `kakuyomuParser`
normalizes Kakuyomu ruby and emphasis marks. Malformed or unknown notation remains
visible and produces a parser warning.

`composeManuscript` requires a composer. The built-in grid composer produces a
self-contained snapshot containing the parsed manuscript, accepted settings,
geometry, statistics, and page/stage/line/cell hierarchy. Every occupied
element has source, display, and grapheme ranges; empty placement elements use
`null`.

## Extensions and validation

Parsers implement `ManuscriptParser`. Composers implement `ManuscriptComposer`
and provide Valibot schemas for their settings and layout. Proofreading rules
carry `kind: "parsed"` or `kind: "composed"` to declare which manuscript they
need, and report findings through `context.report`.

A plugin signals its own failure with a `Rejection` — a plain reason string.
Core turns that into a variant of the stage's error union, so plugins never
construct core's error types.

Each concept lives in its own module as a type plus a companion object of the
same name, holding its schema and operations: `ManuscriptRange.merge`,
`PaperSize.of`, `ManuscriptCompositionSettings.defaults`, and so on. Types are
inferred from the schemas with `v.InferOutput`; source, display, and grapheme
ranges are distinct branded types, and plugin IDs are branded `NamespacedId`.

Processing functions return `ManuscriptResult`: success carries warnings, and
failure carries exactly one error from a discriminated union, so callers can
`switch` on `error.kind` exhaustively. Each error variant exposes its context
as typed fields; `describe` renders one for display. Invalid settings and
plugin output fail explicitly; values are never clamped or partially trusted.

## Source mapping

Source and display ranges are zero-based, end-exclusive UTF-16 offsets.
Grapheme ranges index the normalized grapheme array. Diagnostics include
one-based source line and column positions, so renderers do not need to search
or recalculate locations.

The default proofreading rules report common Japanese novel-style issues and
Unicode variation sequences. Diagnostics do not modify the source and do not
contain automatic fixes.

## Browser support

The package targets browser features that are Baseline Widely Available. It
does not include polyfills.

## License

MIT
