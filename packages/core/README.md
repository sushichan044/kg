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
  createRecommendedProofreadingRules,
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
  rules: createRecommendedProofreadingRules(),
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
need, and report findings through `context.report`. A report may name a
`severity`; omitting it means `error`. A rule's own severity is only its
default: config resolved through `resolveProofreadingRules` (see "Proofreading
rules" below) can override it per rule, the way ESLint and textlint let config
win over a rule's own default.

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

## Proofreading rules

Every built-in rule is registered as a definition — an ID, an optional Valibot
options schema, and a factory — rather than an instance. A config resolves
which rules run, at what severity, and with which options, the way ESLint and
textlint configs do by rule ID:

```ts
import {
  proofreadManuscript,
  recommendedProofreadingRules,
  resolveProofreadingRules,
  ProofreadingConfigError,
} from "@sushichan044/kg-core";

const rules = resolveProofreadingRules({
  rules: {
    ...recommendedProofreadingRules,
    "kg/dash": ["error", { preferred: "―" }],
    "kg/consistent-kanji-opening": "warning",
    "kg/max-arabic-numeral-digits": "off",
  },
});
if (!rules.ok) throw new Error(ProofreadingConfigError.describe(rules.error));

const proofread = proofreadManuscript(composed.value, { rules: rules.value });
```

A config entry is a bare level (`"off" | "on" | "warning" | "error"`) or, for a
rule that takes options, a `[level, options]` tuple. `"off"` and an absent
entry both skip the rule. `"on"` keeps the rule's own report severity;
`"warning"` and `"error"` override every report the rule produces. An unknown
rule ID or invalid options fail explicitly through `ProofreadingConfigError`
rather than being dropped.

`recommendedProofreadingRules` is a plain settings object — not a config with
an `extends` mechanism — holding the rules whose answer does not depend on the
work: how a paragraph opens and how far it is indented, punctuation before a
closing bracket, spacing after `！` and `？`, ellipsis and dash forms and
counts, repeated punctuation and interpuncts, a minus sign that no number
follows, halfwidth Japanese punctuation, Arabic numeral length, and Unicode
variation sequences. `createRecommendedProofreadingRules()` resolves it
directly, for a caller that wants the defaults with no config of its own.

`allProofreadingRules` additionally includes the rules that depend on the
work's own conventions — which width numerals and Latin letters take, whether
a word is written in kanji or kana (`kg/consistent-numeral-width`,
`kg/consistent-latin-width`, `kg/consistent-kanji-opening`). Those rules report
`warning` by default, so opting in through this preset does not silently start
failing a build.

`kg/dash` prefers `―` (U+2015) by default; pass `{ preferred: "—" }` or
`{ preferred: "─" }` when a work uses U+2014 or U+2500 instead. The selected
character must appear in even-length runs. Repeated choonpu (`ー`) are not
treated as dashes.

Diagnostics do not modify the source and do not contain automatic fixes.

## Browser support

The package targets browser features that are Baseline Widely Available. It
does not include polyfills.

## License

MIT
