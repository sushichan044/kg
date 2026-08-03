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
  DEFAULT_COMPOSITION_SETTINGS,
  composeManuscript,
  createDefaultProofreadingRules,
  manuscriptGridComposer,
  parseManuscript,
  pixivParser,
  proofreadManuscript,
} from "@sushichan044/kg-core";

const parsed = parseManuscript(source, { parser: pixivParser });
if (!parsed.ok) throw new Error(parsed.errors[0]?.message);

const composed = composeManuscript(parsed.value, {
  composer: manuscriptGridComposer,
  settings: DEFAULT_COMPOSITION_SETTINGS,
});
if (!composed.ok) throw new Error(composed.errors[0]?.message);

const rules = createDefaultProofreadingRules();
if (!rules.ok) throw new Error(rules.errors[0]?.message);

const proofread = proofreadManuscript(composed.value, { rules: rules.value });
if (!proofread.ok) throw new Error(proofread.errors[0]?.message);

const diagnostics = [...parsed.warnings, ...proofread.value];
```

`parseManuscript` uses `plainTextParser` when no parser is supplied. The Pixiv
parser normalizes ruby, bold, italic, and emphasis notation into a closed
annotation union. Malformed or unknown notation remains visible and produces a
parser warning.

`composeManuscript` requires a composer. The built-in grid composer produces a
self-contained snapshot containing the parsed manuscript, accepted settings,
geometry, statistics, and page/stage/line/cell hierarchy. Every occupied
element has source, display, and grapheme ranges; empty placement elements use
`null`.

## Extensions and validation

Parsers implement `ManuscriptParser`. Composers implement
`ManuscriptComposer` and provide Valibot schemas for their settings and layout.
Proofreading rules declare whether they require a parsed or composed manuscript
and report diagnostics through `context.report`.

All external processing results are validated at the core boundary. Public DTO
and settings schemas are exported for applications that need to validate API or
persistence payloads. Types are inferred from the schemas with
`v.InferOutput`; source, display, and grapheme ranges use distinct branded
types.

Processing functions return `ManuscriptResult`: success values include
warnings, while failures contain structured parse, compose, or proofread
errors. Invalid settings and plugin output fail explicitly; values are never
clamped or partially trusted.

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
