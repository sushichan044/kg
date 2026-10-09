# Separate Japanese typesetting rules, policy, and layout data

Status: Phases 1–3 and the phase 4 existing-annotation additions are implemented.
Complete reference-table coverage and semantic style inputs remain deferred.
Actual font shaping remains proposed.

The composer represents characters, text runs, ruby associations, boundaries,
and candidate lines separately. This gives each Japanese typesetting rule an owner
and lets the paragraph optimizer work with resolved boxes and adjustment units.
Box, glue, kern, penalty, paragraph-wide optimization, and source mapping remain
the basis of composition.

[ADR 0006](adr/0006-separate-jlreq-rules-policy-and-layout-model.md) records this
direction. [Architecture](design.md) describes the current implementation.

## Reference and scope

The reference is the [11 August 2020 JLReq Working Group Note][jlreq]. Section
numbers and links below refer to that version. JLReq describes requirements and
multiple established practices; this document records which practice kg adopts
and which behavior is a product-specific approximation. A preserved approximation
does not establish conformance to the corresponding JLReq procedure.

The concrete design covers vertical novel body text: punctuation, Japanese and
Western mixed text, ruby, emphasis dots, sidelines, paragraph boundaries, line
adjustment, and their relationships to character size, line spacing, and the text
area. Horizontal composition, warichu, formulas, reference marks, subscripts,
tabular alignment, headings, notes, and figures require additional input concepts
and are recorded as deferred below.

The published Note is the authority for this design. Existing profile tests also
cite appendix PDFs from the w3c/jlreq repository at commit `04837cd`. Their table
transcriptions are useful regression evidence, not a replacement for the Note's
prose and notes. This design does not import changes from an editor's draft. A
future change based on a draft must record its revision and its difference from
the published reference.

## Structural migration and remaining work

The core separates parsing, composition, and proofreading. The composition
pipeline now separates reference admissibility, selected book style, candidate
resolution, adjustment allocation, and paragraph evaluation.

| Concept                                 | Implemented responsibility                                                                   | Remaining work                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `JapaneseTypesettingRules`              | Classification, box metrics, spacing capacities, break permission, and hanging eligibility   | Complete contextual spacing tables and additional reference coverage |
| `BookStyle` and `ParagraphEvaluation`   | Selected bracket scheme; independent adjustment stages and visual costs; paragraph scoring   | Additional selectable styles                                         |
| `CompositionRun` and `RubyAssociation`  | Oriented members, independent ruby indexes, and composer-owned combined render units         | Additional annotation placement rules                                |
| `BoundaryRule`                          | Separate break constraints, spacing permission, and final expansion eligibility              | Complete ruby appendix B/C table coverage                            |
| `SourceSpace`                           | Authored range, purpose, natural width, and edge behavior                                    | New semantic space purposes only with corresponding input features   |
| `JapaneseParagraph` and `CandidateLine` | Candidate-local ruby metrics, line edges, coupled adjustments, and numeric fitting           | Further reference-derived spacing schemes                            |
| `measureSourceLine`                     | Intrinsic metrics and validated aggregate/clustered measurements; candidate-owned ruby width | Real font shaping and new semantic annotation inputs                 |
| Viewer                                  | Explicit render units, exact/shared diagnostic positions, and core-positioned ruby/emphasis  | Agreement with a future shaped provider's fonts                      |

Paragraph preparation classifies each base once and indexes ruby membership
before candidate expansion. The DP and allocator receive numeric data and do not
inspect JLReq class identifiers or ruby kinds. Source-space edge widths and
separator suppression are resolved per candidate. Ordinary ideographic spaces
retain their existing glyph output.

The initial style preserves kg's invisible-line-end-first reduction order and
its zero visual cost. The order differs from the reference procedure. Coupled
middle-dot reduction spends its preceding and trailing slots once and leaves
any other capacity at its original stage. Finite capacities and the eligible
slot set for final expansion remain separate.

Mono and fittable-group readings are resolved for each candidate. Lexical classes
remain available for base metrics, while ruby boundary queries distinguish cl-22
and cl-23 context. JLReq 3.3.8 supplies neighbor-dependent overhang limits, including
punctuation spacing after adjustment. Independent readings over intervening kana
retain one ruby-em clearance. Unresolved excess widens the bases before scoring.
Jukugo segments use candidate-local one-ruby-em bounds and succeeding-base-first
packing. Their interiors allow legal base breaks but exclude ordinary line
expansion. Oversized groups carry a reading-cluster cursor through the paragraph states.
Their contiguous reading intervals are assigned in proportion to intrinsic base
advances before fitting, with reading reserved for remaining fragments when
possible. The terminal transition consumes the complete reading. The [phase 4 plan](plans/adr-0006-phase-4/overview.md)
records that sequence and the deferred semantic-style boundary.

## Coverage and ownership

`Implemented` means the stated behavior exists in the inspected code and tests;
it does not certify the entire cited section. `Partial` identifies an implemented
subset. `Policy` identifies a chosen style or product decision. `Missing` is in
the concrete design but not implemented. `Deferred` needs an additional input
concept outside the current body-text design.

### Body-text requirements

| Reference                                                     | Rule or choice and kg policy                                                              | Current status and evidence                                                                                                                     | Model owner / verification                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [2.1.1–2.1.3][characters]                                     | Retain character identity and source association; use logical em by default               | Partial: parsed graphemes and East Asian Width measurements; no font shaping                                                                    | Source grapheme and measurement / combining and supplementary characters              |
| [2.2.1–2.2.5][page-format], [2.4.1–2.4.2][hanmen]             | Derive the text area from line length, line count, columns, and character size            | Partial: `NovelFlowSettings` and `ManuscriptGeometry`; fixed line and stage gaps                                                                | Geometry / one and multiple stages; paper overflow                                    |
| [2.3.1–2.3.2][direction]                                      | Keep inline and block coordinates distinct in vertical composition                        | Partial: vertical-rl only                                                                                                                       | Run orientation and geometry / upright, sideways, combined text                       |
| [2.5.1–2.5.3][page-elements], [4.5.1][line-gap]               | Preserve the chosen line pitch when placing interlinear annotations                       | Partial: fixed pitch and logical right-side annotation clearance; no font-backed block ink metrics                                              | Annotation placement and geometry / annotation on first and last lines                |
| [3.1.1][punctuation-direction]                                | Select punctuation treatment for the writing direction                                    | Partial: vertical presentation and character lists; no direction-specific font realization                                                      | Classification and measurement / vertical punctuation variants                        |
| [3.1.2][punctuation-position]                                 | Separate a punctuation box from its surrounding spaces                                    | Implemented for the profile's half-em classes and render offsets                                                                                | Box metrics and boundaries / parentheses, comma, period, middle dot                   |
| [3.1.3][punctuation-exceptions]                               | Account for punctuation whose visual position differs from the usual font layout          | Partial: class-based render offsets, without a glyph-position query                                                                             | Measurement and render span / custom metrics and variant glyphs                       |
| [3.1.4][punctuation-sequences], [B][spacing-table]            | Resolve pair spacing using both classes and the notes applicable to the pair              | Partial: table rules for the supported classes; ruby-context cells absent                                                                       | Boundary rules / consecutive opening and closing brackets, comma before middle dot    |
| [3.1.5][opening-head]                                         | Choose one line-head bracket scheme and distinguish paragraph start from continuation     | Policy: scheme ③, half-em at paragraph start and flush at a turned-over head                                                                    | Paragraph context and book style / same bracket at both kinds of head                 |
| [3.1.6][dividing-marks]                                       | Model the source space following question or exclamation marks with an edge disposition   | Partial: recognized source gap becomes fixed glue or is suppressed at wrapping                                                                  | Source space and line context / `？　次` inside and across a line                     |
| [3.1.7][line-start], [3.1.8][line-end], [C][break-table]      | Resolve prohibited breaks independently from spacing                                      | Partial: precomputed class, run-interior, and group-ruby break constraints; no complete contextual appendix C model                             | Boundary / forbidden head and tail; group interior versus exterior                    |
| [3.1.9][end-punctuation]                                      | Treat line-end choices as discrete; couple a middle dot's applicable surrounding spaces   | Implemented for current classes through granularity and absorption                                                                              | Line context and adjustment unit / whole versus partial removal                       |
| [3.1.10][unbreakable]                                         | Express binding sequences as boundaries of a recognized unit                              | Partial: all adjacent cl-08 pairs and presentation groups bind; same-mark repetition is not distinguished from unlike cl-08 marks               | Run recognition and boundary / double dash, mixed marks, numerals and units           |
| [3.1.11][no-expansion]                                        | Decide expansion permission separately from break permission                              | Partial: independent boundary spacing and expansion records; current style excludes run and fittable-group interiors                            | Boundary / a forbidden break that still admits a specified spacing adjustment         |
| [3.1.12][adjustment-examples], [3.8.1–3.8.2][line-adjustment] | Evaluate feasible fitting and hanging alternatives before selecting paragraph breaks      | Partial: paragraph DP and comma/period hanging; paragraph-end handling is a kg policy                                                           | Candidate resolver and optimizer / closing bracket after a potential hanging comma    |
| [3.2.1][mixed], [3.2.3–3.2.4][vertical-mixed]                 | Recognize orientation before measurement; keep orientation separate from membership       | Policy: ASCII two-digit runs combine, single characters and recognized abbreviations stand upright, other ASCII alphanumeric runs turn sideways | Run recognition / `A`, `NASA`, `spring`, `12`, fullwidth letters                      |
| [3.2.5][tcy]                                                  | Compose tate-chu-yoko as a unit whose interior is not a line-break opportunity            | Partial: composer-owned combined public units and exact member positions; automatic recognition is narrower than all described uses             | Combined unit / one-em `12`, ruby and diagnostics on its members                      |
| [3.2.6][western-spacing]                                      | Apply mixed-text spacing to the appropriate composition context                           | Partial: quarter-em pair rules and source word spaces; no actual proportional font shaping                                                      | Boundary and measurement / upright Latin beside kana versus sideways Western text     |
| [3.3.1–3.3.2][ruby-usage]                                     | Preserve ruby kind and the base-to-reading association supplied by notation               | Implemented: group, mono, jukugo; overlapping ruby associations and mismatched segments are rejected                                            | Ruby association / association survives run recognition                               |
| [3.3.3][ruby-size]                                            | Make reading size explicit in measurement and placement                                   | Policy: half-size ruby is explicit in measurement scale and decoration placement                                                                | Annotation style / one consistent ratio in measurement and output                     |
| [3.3.4][ruby-side]                                            | Decide the annotation side before placement                                               | Partial: explicit right-side placement in core output; no selectable annotation side                                                            | Annotation style and placement / chosen side independent of renderer                  |
| [3.3.5][mono-ruby]                                            | Place each mono reading against its own base                                              | Implemented for logical mono placement: per-base anchors and contextual overhang                                                                | Ruby candidate layout / short and long mono readings                                  |
| [3.3.6][group-ruby]                                           | Place a reading against its whole base group and account for internal spacing             | Partial: fittable-group protection and candidate-local overhang; oversized splitting is a kg extension                                          | Ruby association and candidate layout / short, equal, and long reading                |
| [3.3.7][jukugo-ruby], [F.1–F.4][jukugo-appendix]              | Preserve per-base readings while jointly arranging the compound and its fragments         | Partial: joint one-ruby-em placement and split recomposition; full appendix F spacing distributions pending                                     | Ruby candidate layout / reading lengths 1 and 3; compound split between bases         |
| [3.3.8][ruby-overhang], [B.2][spacing-notes]                  | Resolve permitted overhang from neighboring context and keep reading runs distinguishable | Partial: candidate-local overhang for all ruby kinds, punctuation limits, and independent-reading clearance                                     | Boundary annotation constraints and candidate placement / kana versus kanji neighbors |
| [3.3.9][emphasis]                                             | Position emphasis marks against their associated base text                                | Implemented for the logical profile: centered half-em marks, punctuation exclusions, and annotation clearance                                   | Positioned annotation / combining marks, combined units, ruby coexistence             |
| [3.5.1–3.5.2][paragraphs]                                     | Keep paragraph-start indentation and continuation indentation explicit                    | Partial: source spaces and bracket scheme; every source newline starts a composition paragraph, with no semantic indent contract                | Paragraph context / authored indentation and continuation line                        |
| [3.8.3][reduction], [D.1–D.2][reduction-table]                | Separate admissible reductions from the order selected by the book style                  | Partial + policy: explicit units with independent stages and costs; kg spends invisible line-end space before word spaces                       | Adjustment unit and policy / a line with both opportunities                           |
| [3.8.4][expansion], [E.1–E.2][expansion-table]                | Distinguish bounded stages from the final expansion opportunities                         | Partial: finite stages and final-stage pair set for current classes                                                                             | Adjustment unit and policy / bounded word space and evenly distributed remainder      |
| [3.9][classes], [A.1–A.30][class-list]                        | Derive contextual classes without erasing original character identity                     | Partial: lexical classes plus separate cl-22/cl-23 overhang context; complete appendix B ruby cells pending                                     | Classification and association / cl-22 and cl-23 at ruby boundaries                   |
| [4.5.1–4.5.2][line-gap]                                       | Keep body pitch stable while allocating annotation space and paragraph separation         | Partial: fixed geometry, source blank lines, and explicit decoration coordinates; no semantic paragraph-separation contract                     | Geometry and paragraph style / adjacent annotated lines                               |

### Deferred requirements

| Reference                                   | Current limitation                                 | Additional concept and boundary                                                        |
| ------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [2.3][direction], [3.2.2][horizontal-mixed] | Body composition is vertical only                  | Horizontal writing context, baseline metrics, and a renderer accepting both directions |
| [2.6][running-heads]                        | No running-head or page-number semantics           | Page furniture independent of body paragraph layout                                    |
| [3.4.1–3.4.3][warichu], A.28–A.29           | No warichu annotation or subline layout            | A nested subline object with its own fitting procedure                                 |
| [3.6.1–3.6.3][tabs]                         | Tabs are not interpreted as alignment instructions | Tab stops, alignment targets, and paragraph-level alignment input                      |
| [3.7.1–3.7.4][ornaments], A.17–A.18, A.21   | No formula or subscript semantics                  | Base-and-script attachment and mathematical binding rules                              |
| A.20, [4.2][notes]                          | No reference mark or note linkage                  | A semantic reference anchor and note placement outside body line fitting               |
| [4.1][headings], [4.3–4.4][figures]         | No heading, figure, or table blocks                | Block manuscript model and page/column allocation                                      |
| [4.5.3][block-adjustment]                   | No page-wide redistribution along the block axis   | Page-level allocation above the paragraph optimizer                                    |

Sidelines and mixed body character sizes are in the concrete placement design,
but neither has an input contract today. Their future parser annotation and style
types must be added with a notation use case. They are not inferred from bold or
italic annotations. Existing font presets and page dimensions continue to be
product settings rather than a promise of print accuracy.

## Concept model

### Source identity and overlapping associations

`ParsedManuscript` remains the semantic input. Source and display ranges use
end-exclusive UTF-16 offsets; grapheme ranges index the parsed grapheme array.
New offsets within a measurement request are local to that request and must not
reuse a global `DisplayRange` brand.

An oriented run is a contiguous span of base text with one presentation. Its
members retain their own parsed ranges. Ruby associations are a separate index
over those members. A ruby range can cover several runs or only part of a run;
the associations do not become children in a single run tree. Existing rejection
of overlapping ruby associations remains in force. Bold, italic, and emphasis
may overlap ruby without changing its semantic association.

Keep the lexical character class alongside the effective class used by a rule.
An effective class depends on the operation: punctuation box metrics still need
the base character, while a ruby-boundary spacing query needs the ruby complex
and its first or last member. Blindly replacing every ruby base class with cl-22
or cl-23 would lose punctuation and internal base-layout rules.

### Boundary rules and adjustment units

The following target type sketch uses the existing range and ruby types. The
implemented internal records use paragraph-local indexes and resolved spacing;
the public-output and measurement sections below describe the phase 3 contracts;
future decoration variants remain explicitly deferred.
Numeric slot indexes are paragraph-local; separate validated index brands should
be used if these indexes ever cross a public boundary.

```ts
type PresentationKind = "mixed" | "upright" | "sideways" | "tate-chu-yoko";

type CompositionRun = Readonly<{
  range: ManuscriptRange;
  presentation: PresentationKind;
  members: readonly ParsedGrapheme[];
}>;

type RubyAssociation = Readonly<{
  baseRange: ManuscriptRange;
  reading: RubyReading;
}>;

type BreakConstraint =
  | Readonly<{ kind: "allowed"; penalty: number }>
  | Readonly<{
      kind: "prohibited";
      reason: "line-head" | "line-end" | "run-interior" | "ruby-interior" | "binding-sequence";
    }>;

type SpacingSlot =
  | Readonly<{ kind: "boundary"; index: number }>
  | Readonly<{ kind: "source-space"; index: number }>;

type BoundaryRule = Readonly<{
  break: BreakConstraint;
  naturalSpacing: Readonly<{ kind: "glue" | "kern"; widthEm: number }>;
  adjustments: readonly AdjustmentUnit[];
}>;

type AdjustmentUnit = Readonly<{
  kind: "continuous" | "all-or-nothing";
  direction: "shrink" | "stretch";
  stage: number;
  costPerEm: number;
  parts: ReadonlyArray<Readonly<{ slot: SpacingSlot; capacityEm: number }>>;
}>;
```

`BoundaryRule` is the resolved record for a boundary in a particular context.
The paragraph also owns a registry of adjustment units, including source-space
and coupled units. Its allocator visits each unit once; a coupled unit is not
spent again because another boundary refers to it. The sum of a unit's parts is
its capacity. A direction is resolved independently: a shrink capacity cannot
be reused as a stretch capacity.

Rule resolution supplies available capacities. The book style supplies `stage`
and `costPerEm`. The optimizer uses the latter to compare candidates, not to
decide which operation is permitted. An invisible end reduction can therefore
cost zero without forcing it to be the first specification stage. The initial
kg style explicitly preserves its existing order as well as its zero cost.

Finite stages distribute continuous adjustment using the same current
character-size assumptions. All-or-nothing units are spent whole or skipped.
The final expansion stage is represented separately as an eligible slot set
with no finite capacity; it must not be encoded as an infinite numeric amount.
Mixed-size text must supply character-size weights before using the same
allocator. Capacity alone is not a general substitute for character size.

### Spaces and candidate line context

A source space records its range, its purpose, its natural width, and its edge
behavior. Purposes distinguish an ordinary ideographic space, a recognized
question/exclamation separator, and a Western word space. A Western edge space
is present with zero advance; a suppressed separator is present in source mapping
with a suppression reason. Generated spacing has no authored source character.

The candidate builder knows the source interval, visible interval, head kind,
whether the line ends the paragraph, neighboring runs, and any ruby fragments.
It resolves line-head, internal, and line-end rules there. A space or annotation
cannot be assigned its final edge treatment once for the entire paragraph.

```text
ParsedManuscript
    -> oriented runs + source spaces + ruby associations
    -> intrinsic measurements + boundary constraints
    -> candidate-local ruby placement, edge spacing, adjustment units
    -> feasible CandidateLine values
    -> paragraph dynamic programming
    -> positioned render units + annotations + source mappings
    -> page and stage allocation
```

The generic allocator and DP operate on numeric metrics, slots, constraints, and
scores. They do not inspect cl-NN values or annotation kinds. A JLReq resolver
owns the contextual interpretation. Keep this resolver internal: the design
does not introduce a public arbitrary rule plugin or a new settings UI.

### Ruby and other annotation placement

The mono and fittable-group resolver implements contextual placement before
candidate scoring. Jukugo placement also uses candidate-local bounds and joint
packing. The complete procedure below defines the remaining oversized-group
and decoration work:

1. Intersect the candidate base range with each ruby association. Keep mono and
   jukugo reading segments tied to their base graphemes. For oversized group
   ruby, retain the current proportional allocation as a named kg policy.
2. Compute intrinsic base and reading widths. Reading size is explicit, initially
   `0.5` body em. Track annotation ink occupancy separately from base advances.
3. Resolve permitted leading and trailing overhang from the adjacent effective
   classes, applicable appendix B notes, and the chosen style. A line edge is a
   separate context; overhang cannot consume space in a neighboring line.
4. Arrange jukugo segments jointly, retaining their associations and legal split
   points. The book style selects appendix F's one-ruby-em overhang
   variant and the succeeding-base-first procedure. Mono placement is not an
   adequate replacement for this compound-level decision.
5. Resolve the complete sequence of reading runs on the candidate, including
   collisions over intervening kana. Use the one-ruby-em separation scheme
   discussed in 3.3.8, inserting required base spacing rather than overlapping
   reading ink. Apply style-defined base expansion to unresolved excess.
6. Include the resulting base widths in fitting and then place readings against
   the adjusted base. Reject the candidate if line adjustment invalidates a ruby
   clearance; do not fix the selected line afterward in the viewer.

The initial style allows the reference's usual overhang over kana and forbids it
over adjacent kanji. Bracket and punctuation amounts come from the applicable
notes, not one global overhang constant. The mono and fittable-group implementation enables this style. Changed breaks
and reading positions are intentional phase 4 behavior changes.

Group-ruby fragments account for the reading already assigned to preceding
fragments. The DP continuation is a reading-cluster cursor; state identity includes
source position, cursor, and fitness, and candidate-cache identity includes the
cursor. Each transition assigns a contiguous reading interval before scoring.
The kg proportional policy rounds the cumulative intrinsic base share to the
nearest complete reading-cluster boundary. When enough clusters remain, reserve
at least one per minimum remaining body line. Empty readings are allowed when
there are fewer clusters than fragments. Terminal transitions consume every
remaining cluster. Selected lines use these intervals without redistribution.

Annotation placement records side, inline extent, and block extent. The default
vertical ruby side is right, in the fixed half-em area immediately before the
body's block-start edge. Each independent reading run and nonempty emphasis mark
must fit that area and avoid the other decorations on the candidate. A collision
excludes the candidate before scoring; if all alternatives fail, core returns a
`ComposerRejected` reason describing the annotation conflict. Forced-overflow
lines receive the same clearance check. Font shaping may require richer
block-direction ink metrics; these checks concern declared logical extents.

Emphasis uses a half-em inline extent centered on the existing render-unit
anchor, including combined units. JLReq 3.3.9 excludes brackets, commas, and full
stops. Empty marks retain their semantic fragments but occupy no ink. No viewer
changes line pitch or chooses another annotation side to resolve a conflict.
Sidelines, selectable opposite-side annotations, and mixed body sizes require
future semantic inputs. Their initial size choices are 0.75, 1, and 1.25 times
body size, with fixed pitch and refusal when the annotation area cannot fit.

## Public composition output

The public output makes a combined render unit explicit while retaining the
existing glyph, glue, kern, and suppressed concepts. A source mapping locates
logical text; it does not promise an exact caret position inside a shaped glyph.

```ts
type SourcePlacement =
  | Readonly<{
      kind: "exact";
      range: ManuscriptRange;
      layoutSpan: InlineSpan;
    }>
  | Readonly<{
      kind: "shared";
      ranges: readonly ManuscriptRange[];
      layoutSpan: InlineSpan;
    }>;

type RenderUnitCommon = Readonly<{
  value: string;
  range: ManuscriptRange;
  layoutSpan: InlineSpan;
  renderSpan: InlineSpan;
  sources: readonly SourcePlacement[];
}>;

type SingleGlyphUnit = RenderUnitCommon &
  Readonly<{
    kind: "glyph";
    presentation: "mixed" | "upright" | "sideways";
    disposition: "placed" | "hanging";
  }>;

type CombinedGlyphUnit = RenderUnitCommon &
  Readonly<{
    kind: "combined-glyph";
    presentation: "tate-chu-yoko" | "sideways";
    disposition: "placed";
  }>;

type PositionedInlineItem =
  | SingleGlyphUnit
  | CombinedGlyphUnit
  | ComposedGlue
  | ComposedKern
  | SuppressedInlineItem;
```

`CombinedGlyphUnit` is a single rendering instruction with at least two source
graphemes. The logical implementation uses it for tate-chu-yoko. Default sideways text
remains separate glyphs. A synthetic clustered sideways run uses one combined
unit for the complete run whenever a cluster covers multiple source graphemes.
An actual shaped provider must later agree with the renderer's font realization;
synthetic cluster coverage does not establish that agreement.

Source placement offsets, layout spans, and render spans are line-relative.
Tate-chu-yoko `12` occupies one logical em and retains the current half-em logical
mapping for each digit; that mapping is not a claim about the digits' vertical
ink positions. A shaped `ffi` cluster can instead share one layout span across
all three graphemes. Diagnostics covering any shared member highlight the cluster
and retain the diagnostic's original range. Overlapping diagnostics remain
separate records with the existing lane allocation and selection behavior.

A hanging glyph continues to have zero layout advance and a nonzero render span.
Ranges on glue and suppressed items keep invisible authored text addressable.
`NovelLine.range` continues to cover all source-backed members, including zero-width
spaces and suppressed separators. A renderer must not reconstruct combined units
by comparing `groupRange` values.

Ruby, emphasis, and future sideline fragments carry their resolved inline and
block placement. Their source associations remain separate from render units.
A ruby associated with only the first digit of `12` retains that range but uses
the combined unit as its indivisible physical anchor. A candidate cannot split
that unit to honor an annotation boundary. If several readings on members of the
same unit cannot be placed without collision, composition refuses that layout;
it does not silently discard a reading or split tate-chu-yoko.

The decoration contract makes the per-reading-unit and per-emphasis-mark
positions explicit. Bold and italic keep their existing source-range fragments;
their visual styles do not imply a new decoration kind.

```ts
type AnnotationPlacement = Readonly<{
  side: "before" | "after";
  inlineSpan: InlineSpan;
  blockOffsetEm: number;
  blockSizeEm: number;
}>;

type DecorationFragmentCommon = Readonly<{
  annotationRange: ManuscriptRange;
  fragmentRange: ManuscriptRange;
  continuation: "whole" | "start" | "middle" | "end";
}>;

type PositionedDecorationFragment = DecorationFragmentCommon &
  (
    | Readonly<{
        kind: "ruby";
        rubyKind: RubyReading["kind"];
        reading: string;
        readingItems: ReadonlyArray<
          Readonly<{
            value: string;
            textRange: MeasurementTextRange;
            placement: AnnotationPlacement;
          }>
        >;
      }>
    | Readonly<{
        kind: "emphasis";
        mark: string;
        placements: readonly AnnotationPlacement[];
      }>
    | Readonly<{ kind: "sideline"; placement: AnnotationPlacement }>
  );
```

Inline offsets are relative to the line. Block offsets start at the body's
block-start edge and increase in the block progression direction. In vertical-rl
that edge is the body's right edge, and the positive direction is left;
`before` is right-side placement and `after` is left-side placement. Offsets can
be negative, sizes cannot. The side is the selected annotation side, not an
instruction to recompute the offset in a renderer. Reading item text ranges are
local to the fragment's `reading` string and partition it without loss, including
clusters covering multiple reading graphemes. Initial logical readings use one
item per grapheme. Emphasis placement count follows the candidate's resolved
base anchors, including its decision for members of a combined unit.

This geometry can represent mixed-size decorations, while the initial style
retains half-size ruby and existing mark positions. Sideline fragments become a
public variant only when a corresponding semantic annotation is introduced.

## Measurement contract for logical metrics and future shaping

Measurement remains a synchronous, pure request/result function. The composer
does not own font loading, DOM access, or asynchronous scheduling. A future
provider must be ready before composition begins.

The public contract accepts text runs and distinguishes aggregate metrics from
cluster mappings. These measurement concepts are exported from the plugin entry.
`MeasurementTextRange` is a request-local UTF-16 range branded separately from the
manuscript's offset types. Companion schemas validate provider results at the
measurement boundary; internal candidate fitting trusts the validated data.

```ts
type MeasurementTextRange = Readonly<{ start: number; end: number }>;

type MeasurementRequest = Readonly<{
  text: string;
  fontPreset: FontPresetId;
  fontSizePt: number;
  scale: number;
  writingMode: "vertical-rl";
}> &
  (
    | Readonly<{ kind: "base"; presentation: PresentationKind }>
    | Readonly<{ kind: "ruby"; presentation: "mixed" | "sideways" }>
  );

type MeasuredCluster = Readonly<{
  textRange: MeasurementTextRange;
  layoutSpan: InlineSpan;
  renderSpan: InlineSpan;
}>;

type RunMeasurement =
  | Readonly<{ kind: "advance"; advanceEm: number }>
  | Readonly<{
      kind: "clustered";
      advanceEm: number;
      clusters: readonly MeasuredCluster[];
    }>;

type RunMeasurer = (request: MeasurementRequest) => RunMeasurement;
```

All measurements are in body em. `scale` is the target font size relative to body
size, initially `1` for base and `0.5` for ruby; `fontSizePt` is the body's point
size. The provider applies the scale once. Raw measured advances do not include
JLReq pair spacing, indentation, ruby expansion, or hanging. Punctuation box
metrics and render offsets remain a separate rule-resolution step. Cluster spans
are request-relative until the composer translates them onto a line.

For `advance` results the initial composer measures base text per grapheme and
reading graphemes separately for validation and final placement, as it does today.
For base-width decisions, it also measures each complete group reading or each
mono/jukugo reading segment. Those totals widen the associated base boxes; they
do not replace the per-grapheme reading measurements. A nonadditive run advance
is not distributed evenly across constituent graphemes.
Multi-grapheme aggregate results remain usable for whole-reading width decisions;
positioned run shaping requires `clustered` results. A clustered run's advances
are authoritative, and it must not be remeasured one grapheme at a time.
Tate-chu-yoko fitting is a composer operation: measurement describes the underlying
text, while the target combination occupies one body em. During structural
migration retain the sum of existing member advances, which is one em with the
default provider. Enforcing a one-em fit for arbitrary custom metrics is a later
behavior change; combining output alone must not silently rescale those metrics.

Clusters partition the request text at grapheme boundaries in source order and
may each cover multiple graphemes. Logical layout spans partition the run's
advance; render spans may overlap or overhang. A legal line break never bisects a
cluster. Composition of scripts requiring visual reordering is deferred; this
contract initially covers the existing Japanese/Western contexts.

Font preset, body size, and presentation identify the initial deterministic
measurement context. A later shaped provider must use a fixed font realization
matching the renderer, through provider configuration or an explicit font
resource contract added with that implementation. Cluster spans alone do not
make arbitrary browser fonts reproduce a provider's glyphs. Font fallback, glyph
IDs, exact caret positions, and asynchronous font discovery are outside the
initial migration.

## Validation and API impact

Implement each domain concept as a readonly discriminated type with a companion
object. Public types derive from Valibot schemas. Internal records trust the
validated input and results; no per-loop schema parsing is added.

| Boundary               | Required validation                                                                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parser output          | Existing sequential ranges, nonoverlapping ruby associations, and segment counts; new semantic annotation variants need their own contracts                                                                             |
| Measurement result     | Finite nonnegative advance, valid scales, complete text-range coverage, grapheme-aligned cluster boundaries, and finite signed offsets; layout spans agree with aggregate advance within the existing numeric tolerance |
| Composer output        | Nonempty render units, value/member agreement, exact or shared source coverage without duplication, legal combined boundaries, and consistent line ranges                                                               |
| Positioned annotations | Fragment ranges remain within their associations; reading fragments preserve reading order and content; placement uses the correct line and body-em coordinates                                                         |

Keep source/display/grapheme ranges branded. Keep request-local ranges distinct.
Negative kern widths and signed render offsets remain valid; validation must not
mistake overhang for invalid advance. Empty source lines still produce the current
empty line representation. Oversized indivisible runs retain the current forced
overflow behavior during migration. Invalid provider or composer results return
the existing typed composition failures rather than throwing or clamping.

| Surface                 | Target change                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Core root entry         | Export composed single and combined units and source-placement types for readers; update `NovelLine.items` and positioned annotation types    |
| Core plugin entry       | Export the new measurement request, result, and cluster types; update the measurer accepted by `createNovelComposer`                          |
| Parser and lint entries | Preserve current parse and proofread entrypoints; add semantic annotation variants only with their future input features                      |
| Viewer                  | Consume combined units directly; use exact/shared mappings for diagnostic bands; consume annotation positions instead of resolving typography |
| Frontend                | Update exhaustive item handling and test fixtures; keep persisted flow and appearance settings unchanged during structural migration          |

The output and measurement changes form one coordinated breaking revision with
the updated viewer, package documentation, and custom-composer examples. The old
per-grapheme combination contract has no adapter. Parser/proofreading entrypoints
and persisted settings remain unchanged. Phase 3 publishes existing ruby and
emphasis positions; phase 4 enables new placement behavior and annotation styles.

## Worked verification scenarios

The examples distinguish implemented behavior from future acceptance cases.
Evidence comes from `compose-manuscript.test.ts`, `public-contract.test.ts`,
`run-measurement.test.ts`, internal profile/paragraph tests, and viewer browser
tests. Cases still labelled future are design checks, not passing tests.

| Case                                                                          | Expected decision and responsible data                                                                                                                  | Evidence / phase                                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A closing bracket would follow a hung comma                                   | Reject the break exposing the bracket; hanging does not bypass boundary permission                                                                      | Existing “backs up before punctuation when hanging would expose a closing bracket”; preserve |
| Line-end space is 0.5 em and overflow is 0.2 em                               | Do not spend 0.2 em of a discrete 0.5-em unit; use a continuous opportunity or another break                                                            | Existing whole-end-space tests; preserve                                                     |
| `、・` ends a line                                                            | Couple only the middle dot's preceding and trailing quarters; leave the comma's remaining half at its own stage                                         | Existing middle-dot and pair-table tests; preserve                                           |
| A line has both Western word-space and end-space capacity                     | Record the reference order and kg's different order separately; zero visual cost does not erase the difference                                          | Existing stage and invisible-end-space tests; preserve policy                                |
| `あspring rainい` changes its break around the space                          | The same source space can be a third-em internal glue or zero-width edge glue without losing its range                                                  | Existing Western space tests; preserve                                                       |
| `？　次` wraps after the mark                                                 | Keep the authored gap as suppressed source text; inside a line keep its fixed source glue                                                               | Existing separator and line-range tests; preserve                                            |
| A fittable group ruby is moved to the next line                               | Group association protects its interior breaks independently from spacing data                                                                          | Existing “moves a fittable group ruby as one unit”; preserve                                 |
| A long group ruby spans several lines                                         | Concatenated readings equal the original, in order; preserve the current proportional allocation and one-reading-per-fragment reservation when possible | Existing oversized-group tests; preserve                                                     |
| Mono reading `かんじ` annotates `漢`, followed by `あ` versus `字`            | Candidate boundary context permits the chosen kana overhang but forbids kanji overhang; only unresolved excess expands the base                         | Contextual ruby placement tests                                                              |
| Two long readings overhang the same intervening kana                          | Resolve their ink separation jointly; independent base widening is insufficient                                                                         | One-ruby-em clearance test                                                                   |
| Jukugo `温泉` has readings `おん` and `せん`, or `京都` has `きょう` and `と` | Preserve per-base association, jointly place readings, and recompute fragments if split between bases                                                   | Joint jukugo tests; lengths 1+3, 3+1, 3+2+1, and split compounds                             |
| Group `今日` carries `きょう` at an actual line boundary                      | Keep a fittable group whole; distinguish the kg oversized split extension from the reference's ordinary group handling                                  | Fittable-group protection and candidate edge tests                                           |
| `12` has a diagnostic or ruby on its first digit                              | Emit one combined unit, retain both member ranges, attach the diagnostic to its logical member and ruby to the physical unit                            | Public render-unit tests and viewer exact-digit, ruby, and emphasis browser cases            |
| A provider returns one cluster for `ffi`                                      | Keep all three source graphemes, prohibit an interior break, and highlight the shared cluster without inventing three caret positions                   | Synthetic clustered-provider and viewer shared-ligature tests                                |
| A provider returns overlapping text ranges, a split surrogate, or NaN         | Reject the result at the plugin boundary; never render a partial snapshot                                                                               | Measurement boundary cases and typed invalid-provider rejection tests                        |
| Ruby and emphasis reach a page's first or last line                           | Preserve body pitch and emit explicit block extents; the selected annotation lane may extend beyond the body text area                                  | Core clearance tests and Chromium/WebKit page/stage-edge geometry tests                      |

The current source tests protect ruby kind preservation, mono/group centering,
and group reading conservation. Phase 4 tests cover contextual overhang, joint
jukugo bounds, and cluster-aligned group allocation. Full appendix F spacing
distributions, real font shaping, and selectable sides remain incomplete. Phase 3
tests cover synthetic cluster mappings and the existing decoration coordinates. New behavior tests
must use specification-derived outcomes rather than copying the resolver's
algorithm. Use arrange/act/assert separation, existing `test.extend` fixtures
where needed, and `expect.assert` for premises.

## Migration sequence and completion criteria

| Phase                                 | Work                                                                                                                                              | Behavior gate                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Rules and policy — implemented     | Separate admissibility tables, book-style selection, adjustment order, and scoring; keep the profile internal                                     | Existing pair-table, prohibition, stage, and paragraph-score outcomes are preserved; stage/cost independence has dedicated tests                               |
| 2. Internal model — implemented       | Introduce run and ruby indexes, boundary records, source-space elements, and coupled adjustment units                                             | Same breaks, widths, source ranges, ruby allocation, and forced-overflow results; preserve the existing candidate-expansion regression check                   |
| 3. Public contract — implemented      | Introduce explicit combined units and source placements; migrate measurement types, viewer, frontend fixtures, exports, and package docs together | Equivalent logical and visual results with the default measurer; combined-unit diagnostics, annotation anchors, plugin failures, and viewer browser tests pass |
| 4. Existing annotations — implemented | Enable contextual overhang, joint jukugo bounds, group reading cursors, and existing-decoration clearance; semantic styles deferred               | Each enabled coverage row gains independent acceptance tests; changed layouts are recorded with the selected style and reference                               |

Phase 3 validates the new `clustered` variant using synthetic provider fixtures;
an actual font-shaping provider is later work. No persistence migration is needed
until new user settings are introduced. The latter require a separate settings
and storage-version change, not an implicit addition to this refactor.

Run `vp check` and the applicable `vp test --run` projects for implementation
phases. Core work uses `core-unit`; phase 3 also runs viewer and frontend checks,
package builds, and browser scenarios. Avoid dense candidate graphs and repeated
classification in the inner optimizer loop. Ruby continuation retains only the best state per source/cursor/fitness tuple.
For N independent one-em bases, line length L, and at most M active reading
clusters, there are at most 4(N+1)(M+1) states and N(M+1)(2L+1) candidate
resolutions. The cache stores one start window, including refusals. The existing
unannotated 2,000-base candidate-count bound is unchanged. An integrated fixture
with 2,000 bases and 5,000 reading graphemes composes into 250 lines and verifies
complete reading conservation within a five-second regression budget. These
bounds describe logical positive-width fixtures, not arbitrary zero-width or
unbreakable provider data.

This design is complete when every relevant reference section has a coverage
row, every proposed behavior has an owning concept, and the worked cases can be
expressed without renderer-side typesetting or source-range loss. An implemented
phase is complete only after its behavior gate passes. The coverage table must
be updated as phases land so future work can distinguish design capability from
implemented behavior.

[jlreq]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/
[characters]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#characters_and_the_principles_of_setting_them_for_japanese_composition
[page-format]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#page_formats_for_japanese_documents
[hanmen]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#specifying_the_kihonhanmen
[direction]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#vertical_writing_mode_and_horizontal_writing_mode
[page-elements]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#page_wise_arrangement_of_kihonhanmen_elements
[running-heads]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#running_heads_and_page_numbers
[punctuation-direction]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#differences_in_vertical_and_horizontal_composition_in_use_of_punctuation_marks
[punctuation-position]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#positioning_of_punctuation_marks
[punctuation-exceptions]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#exceptional_positioning_of_ideographic_comma_and_katakana_middle_dot
[punctuation-sequences]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#positioning_of_consecutive_opening_brackets_closing_brackets_comma_full_stops_and_middle_dots
[opening-head]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#positioning_of_opening_brackets_at_line_head
[dividing-marks]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#positioning_of_dividing_punctuation_marks
[line-start]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#characters_not_starting_a_line
[line-end]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#characters_not_ending_a_line
[end-punctuation]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#positioning_of_closing_brackets_full_stops_commas_and_middle_dots_at_line_end
[unbreakable]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#unbreakable_character_sequences
[no-expansion]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#character_sequences_which_do_not_allow_space_insertion_as_part_of_line_adjustment_processing
[adjustment-examples]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#examples_of_line_adjustment
[mixed]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#composition_of_japanese_and_western_mixed_texts
[horizontal-mixed]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#mixed_text_composition_in_horizontal_writing_mode
[vertical-mixed]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#mixed_text_composition_in_vertical_writing_mode
[tcy]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#handling_of_tatechuyoko
[western-spacing]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#handling_of_western_text_in_japanese_text_using_proportional_western_fonts
[ruby-usage]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#usage_of_ruby
[ruby-size]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#choice_of_size_for_ruby_characters
[ruby-side]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#choice_of_sides_for_ruby_with_respect_to_base_characters
[mono-ruby]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#positioning_of_monoruby_with_respect_to_base_characters
[group-ruby]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#positioning_of_groupruby_with_respect_to_base_characters
[jukugo-ruby]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#positioning_of_jukugoruby_with_respect_to_base_characters
[ruby-overhang]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#adjustments_of_ruby_with_length_longer_than_that_of_the_base_characters
[emphasis]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#composition_of_emphasis_dots
[paragraphs]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#paragraph_adjustment_rules
[warichu]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#inline_cutting_note
[tabs]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#tab_setting
[ornaments]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#other_rules_of_japanese_typesetting
[line-adjustment]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#line_adjustment
[reduction]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#procedures_for_intercharacter_space_reduction
[expansion]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#procedures_for_intercharacter_space_expansion
[classes]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#about_character_classes
[class-list]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#character_classes
[spacing-table]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#spacing_between_characters
[spacing-notes]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#notes_a2
[break-table]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#possibilities_for_linebreaking_between_characters
[reduction-table]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#opportunities_for_intercharacter_space_reduction_during_line_adjustment
[expansion-table]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#opportunities_for_intercharacter_space_expansion_during_line_adjustment
[jukugo-appendix]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#positioning_of_jukugoruby
[line-gap]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#line_gap_arrangement_with_ruby_and_other_objects
[block-adjustment]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#adjustment_of_processing_of_realm_in_block_direction
[notes]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#processing_of_notes
[headings]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#handling_of_headings
[figures]: https://www.w3.org/TR/2020/NOTE-jlreq-20200811/#positioning_of_illustrations
