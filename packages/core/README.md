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

## Entry points

The package is split by what you are doing, so an application only ever sees the
surface it needs.

| Entry                          | For                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `@sushichan044/kg-core`        | Running the pipeline and reading what comes out: parse, compose, settings, results, diagnostics |
| `@sushichan044/kg-core/lint`   | Proofreading — running the rules, and writing your own                                          |
| `@sushichan044/kg-core/plugin` | Supplying an implementation to core: a parser, a composer, or a measurer                        |

A name is exported only when one of those three needs to write it. Helpers core
keeps for itself are not part of the API.

## Processing pipeline

```ts
import {
  ComposeError,
  composeManuscript,
  NovelCompositionSettings,
  novelComposer,
  ParseError,
  parseManuscript,
  kakuyomuParser,
  pixivParser,
} from "@sushichan044/kg-core";
import {
  createDefaultProofreadingRules,
  ProofreadError,
  proofreadManuscript,
} from "@sushichan044/kg-core/lint";

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
inline items and annotation fragments. `glyph` items distinguish their typographic
`layoutSpan` from their visual `renderSpan`; `glue`, `kern`, and `suppressed` items
preserve every spacing decision. Each line also records its `inlineSizeEm` and
whether it ended naturally, by shrinking, stretching, hanging, forcing, or reaching
the paragraph end.

The composer classifies the core prose classes from JLReq, resolves pair spacing,
and selects line breaks over the whole source paragraph. The space between two
classes follows appendix 表1 of JLReq: a half em before an opening bracket and after
a closing bracket, comma, or full stop, a quarter em on either side of a middle dot,
a quarter em between Japanese and a numeral, unit symbol, or Western character, and
solid where two of those punctuation marks meet.

An overflowing line is answered by reducing that space or by hanging a comma or full
stop; a short line is answered by opening up space where JLReq 3.8.4 and appendix 表6
allow it — the Japanese-to-Western quarter em first, up to a half, then a solid pair
between kana, kanji, and the marks that go with them, up to a quarter. Space around
brackets, commas, full stops, middle dots, hyphens, and an ideographic space is never
opened up. A line that admits none of these is forced. The choice is made for the
paragraph rather than line by line,
minimizing in order the number of forced lines, then stretched, then hanging, then
shrunk lines that spent visible space. Which space may be reduced, and in which
order, follows JLReq 3.8.3 and appendix 表3: the space at the line end goes first and
costs the paragraph nothing, because it is invisible once that character lands there;
then a middle dot's quarters, then the half em before an opening bracket or after a
closing bracket or comma, then the Japanese-to-Western quarter down to an eighth. The
half em after a mid-line full stop marks the end of a sentence and is never reduced,
and neither is the half em that keeps a line-head opening bracket off the edge.

JLReq 3.1.5 states the white before a line-head opening bracket as a pair of amounts:
one for 改行行頭, the head of a line that starts a paragraph, and one for 折返し行頭, the
head of a line the composer turned over. The specification lists three such pairs, and
the composer takes the one Japanese novels are set with — scheme ③: a half em at
改行行頭, and 天付き, flush against the edge, at 折返し行頭.

The composer also owns Japanese line-start and line-end restrictions, inseparable
punctuation, question/exclamation gap suppression, and ruby placement.

The composer classifies vertical text before measuring and breaking lines. Following
[JLReq](https://www.w3.org/TR/jlreq/#mixed_text_composition_in_vertical_writing_mode),
upright Latin initials and abbreviations advance by one em per character, Western
words remain unbroken and render sideways, and two ASCII digits form one
tate-chu-yoko unit. The resulting `VerticalTextPresentation` is carried by every
glyph item, so renderers do not need to infer orientation independently.

The default logical measurer uses East Asian Width in a Japanese context. Upright
ASCII advances by one em; proportional ASCII and the members of a tate-chu-yoko unit
advance by half an em. Supply a synchronous measurer when the caller has more accurate
font metrics. Base-text requests also include the selected `presentation`:

```ts
import { createNovelComposer } from "@sushichan044/kg-core/plugin";

const composer = createNovelComposer({
  measurer: (request) => ({
    advanceEm: measureWithAvailableFont(request.text, {
      role: request.role,
      fontPreset: request.fontPreset,
      writingMode: request.writingMode,
      ...(request.role === "base" ? { presentation: request.presentation } : {}),
    }),
  }),
});
```

A measurer returns `{ advanceEm }` in logical em units. Negative or non-finite
results reject the composition instead of producing a partial layout.

Ruby annotations retain one of three associations: `group` for one reading over
the entire base, `mono` for one reading segment per base grapheme, and `jukugo`
for a compound whose segments remain associated with each base grapheme. A
parser result with mismatched `mono` or `jukugo` segment counts is invalid.

## Extensions and validation

Everything in this section comes from `@sushichan044/kg-core/plugin`, except
proofreading rules, which are authored against `@sushichan044/kg-core/lint`
alongside the built-in ones.

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

A companion object is exported as a value only when one of the three roles
calls something on it. Concepts you only ever read out of a composed layout —
`NovelPage`, `ComposedGlyph`, `LineBreakResult`, and the like — are exported as
types alone, so their schemas are not part of the API. The settings you persist
and re-validate keep theirs: `NovelCompositionSettings.schema`,
`ManuscriptAppearanceSettings.schema`, `ManuscriptOffsets.schema`,
`NovelFlowSettings.schema`, and the appearance picklists.

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

Proofreading has its own entry point, `@sushichan044/kg-core/lint`. Nothing in
the root entry imports from it, so an application that only parses and composes
never pulls the rules into its bundle.

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
} from "@sushichan044/kg-core/lint";

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
