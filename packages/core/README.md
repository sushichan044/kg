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
  createNovelComposer,
  createDefaultProofreadingRules,
  NovelCompositionSettings,
  novelComposer,
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

`parseManuscript` uses `plainTextParser` when no parser is supplied. The built-in
`pixivParser` normalizes ruby, bold, italic, and emphasis notation; `kakuyomuParser`
normalizes Kakuyomu ruby and emphasis marks. Malformed or unknown notation remains
visible and produces a parser warning.

`composeManuscript` requires a composer. The built-in `novelComposer` produces
a self-contained snapshot containing the parsed manuscript, accepted settings,
geometry, statistics, and a page/stage/line hierarchy. Lines contain positioned
graphemes, suppressed source graphemes, and annotation fragments. The composer
owns Japanese line-start and line-end restrictions, inseparable punctuation,
hanging punctuation, question/exclamation gap suppression, and ruby placement.

The composer classifies vertical text before measuring and breaking lines. Following
[JLReq](https://www.w3.org/TR/jlreq/#handling_of_western_text_in_vertical_writing),
upright Latin initials and abbreviations advance by one em per character, Western
words remain unbroken and render sideways, and two ASCII digits form one
tate-chu-yoko unit. The resulting `VerticalTextPresentation` is carried by every
positioned grapheme, so renderers do not need to infer orientation independently.

The default logical measurer uses East Asian Width in a Japanese context. Upright
ASCII advances by one em; proportional ASCII and the members of a tate-chu-yoko unit
advance by half an em. Supply a synchronous measurer when the caller has more accurate
font metrics. Base-text requests also include the selected `presentation`:

```ts
const composer = createNovelComposer({
  measurer: ({ text, role, fontPreset, writingMode }) =>
    measureWithAvailableFont(text, { role, fontPreset, writingMode }),
});
```

A measurer returns logical em units. Negative or non-finite results reject the
composition instead of producing a partial layout.

Ruby annotations retain one of three associations: `group` for one reading over
the entire base, `mono` for one reading segment per base grapheme, and `jukugo`
for a compound whose segments remain associated with each base grapheme. A
parser result with mismatched `mono` or `jukugo` segment counts is invalid.

## Extensions and validation

Parsers implement `ManuscriptParser`. Composers implement `ManuscriptComposer`
and provide Valibot schemas for their settings and layout. Proofreading rules
carry `kind: "parsed"` or `kind: "composed"` to declare which manuscript they
need, and report findings through `context.report`. A report may name a
`severity`; omitting it means `error`.

A plugin signals its own failure with a `Rejection` — a plain reason string.
Core turns that into a variant of the stage's error union, so plugins never
construct core's error types.

Each concept lives in its own module as a type plus a companion object of the
same name, holding its schema and operations: `ManuscriptRange.merge`,
`PaperSize.of`, `NovelCompositionSettings.defaults`, and so on. Types are
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

`createDefaultProofreadingRules()` returns the rules whose answer does not
depend on the work: how a paragraph opens and how far it is indented,
punctuation before a closing bracket, spacing after `！` and `？`, ellipsis and
dash forms and counts, repeated punctuation and interpuncts, a minus sign that
no number follows, halfwidth Japanese punctuation, Arabic
numeral length, and Unicode variation sequences.

Rules that depend on the work's own conventions are exported individually and
report `warning` instead of `error`, so a caller opts into them:

```ts
import {
  consistentKanjiOpeningRule,
  consistentLatinWidthRule,
  consistentNumeralWidthRule,
  createConsistentKanjiOpeningRule,
  createDefaultProofreadingRules,
} from "@sushichan044/kg-core";

const rules = [
  ...createDefaultProofreadingRules(),
  consistentNumeralWidthRule(),
  consistentLatinWidthRule(),
  consistentKanjiOpeningRule(),
];
```

`createConsistentKanjiOpeningRule({ pairs })` replaces the built-in kanji and
kana pairs; like every configurable rule it returns a `ManuscriptResult` and
fails with `InvalidRuleOptions` rather than dropping bad options.

`dashRule()` prefers `―` (U+2015). Use `createDashRule({ preferred: "—" })` or
`createDashRule({ preferred: "─" })` when a work uses U+2014 or U+2500 instead.
The selected character must appear in even-length runs. Repeated choonpu (`ー`)
are not treated as dashes.

Diagnostics do not modify the source and do not contain automatic fixes.

## Browser support

The package targets browser features that are Baseline Widely Available. It
does not include polyfills.

## License

MIT
