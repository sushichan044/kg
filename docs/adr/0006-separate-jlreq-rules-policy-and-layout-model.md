# ADR 0006: Separate JLReq rules, book style, and layout data

- Status: Accepted design; implementation pending
- Date: 2026-10-08
- Extends: ADR 0005
- Detailed design: [Japanese typesetting model](../jlreq-typesetting-model.md)

## Context

ADR 0005 introduced boxes, glue, kerns, and penalties with paragraph-wide line
optimization. Those concepts remain useful. The current profile also owns book
style and optimizer preferences, while several internal fields serve unrelated
decisions. Presentation group ranges determine both line-break protection and
rendering combination. `pairSpacingAfter` derives spacing permission from those
groups and group-ruby fitting. Adjustment priority determines both execution
order and deformation cost.

Ruby annotations preserve group, mono, and jukugo associations, but placement
widens base boxes before line selection. The current pipeline cannot express
neighbor-dependent ruby overhang or jointly arranged jukugo readings. The viewer
reconstructs combined tate-chu-yoko units from individual glyphs. Further JLReq
coverage would add conditions to these shared representations unless their
responsibilities are separated.

## Decision

Use the [2020 JLReq Working Group Note](https://www.w3.org/TR/2020/NOTE-jlreq-20200811/)
as the reference for a documented vertical novel-body profile. Maintain a
coverage table distinguishing implemented behavior, partial coverage, selectable
styles, product-specific approximations, and deferred input structures.

Separate reference admissibility rules from the selected book style and the
paragraph optimizer's evaluation. Keep those rules and style internal. Preserve
the current rendering behavior during structural migration, including the
product choice to reduce invisible line-end space before Western word spaces.
That choice differs from the reference procedure and must remain visible in the
coverage table.

Represent source graphemes, oriented runs, ruby associations, boundaries,
candidate lines, and adjustment units separately. Runs and ruby associations
share ranges without requiring one nested tree. Boundary break permission and
spacing permission are independent. Coupled adjustments name all affected
spacing slots, and execution stage is separate from visual cost.

Resolve line edges and future annotation requirements for each candidate before
scoring it. Keep dynamic programming and adjustment allocation independent of
JLReq class identifiers. Retain boxes, glue, kerns, source mapping, and the
existing paragraph optimization strategy.

The target public result contains explicit combined render units and exact or
shared source placements. The composer determines tate-chu-yoko combination;
the viewer consumes it. Layout spans and render spans remain distinct, including
zero layout advance for hanging punctuation and source-backed invisible text.

The target synchronous measurement contract accepts runs and distinguishes
aggregate advances from cluster mappings. Default composition remains logical
em and DOM-independent. Future cluster mappings can cover multiple graphemes
without inventing caret positions inside a ligature. Actual font realization and
renderer agreement require a later shaped-provider implementation.

## Consequences

The design document defines proposed types, source invariants, coverage owners,
worked cases, and migration gates. It describes future contracts explicitly;
the current code and published package APIs are unchanged by this ADR.

The later public-output and measurement migration is a coordinated breaking
change to core, plugin authors, viewer, and application fixtures. Parser source
identity remains stable. No legacy combination adapter or arbitrary profile
plugin is introduced. Existing persisted settings remain valid until a separate
feature adds settings requiring migration.

Ruby overhang, joint jukugo placement, positioned decorations, and additional
styles follow the structural migration as separate behavior changes. Each gains
reference-derived acceptance cases before its coverage status changes. Warichu,
formulas, reference marks, subscripts, horizontal composition, and document blocks
remain deferred with their required input concepts documented.

## Alternatives

### Continue extending the current atom and profile

This retains the shared responsibilities that cause new rules to affect breaking,
spacing, scoring, and rendering at once. The model needs independent boundary
and annotation information to describe those decisions.

### Replace paragraph optimization with a different line-breaking algorithm

The identified problems concern the information available to an algorithm.
Changing the search algorithm would not supply ruby relationships, contextual
edge rules, or explicit render units. Keep the current optimizer while improving
its input and candidate representation.

### Put every annotation and run in one tree

Ruby and style ranges can cross run boundaries or cover only some members of a
combined unit. Independent range associations preserve these relationships
without duplicating source characters to fit a hierarchy.

### Introduce font shaping as part of the initial refactor

Current deterministic logical measurement is sufficient to verify the structural
migration. Define the cluster-capable interface now and implement real font
shaping later with renderer agreement and dedicated mapping tests.
