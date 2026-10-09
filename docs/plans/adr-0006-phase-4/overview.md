# ADR 0006 body-text additions

Implement existing ruby and emphasis placement in four dependent changes. Core
resolves annotation requirements before paragraph scoring; the viewer draws the
resolved coordinates. The reference is the 11 August 2020 JLReq Note.

## Delivery sequence

1. [Contextual mono and group ruby](plans/01-ruby-overhang.md)
2. [Joint jukugo placement](plans/02-jukugo-ruby.md)
3. [Candidate-local group reading allocation](plans/03-group-ruby-cursor.md)
4. [Existing decoration clearance](plans/04-annotation-clearance.md)

Each change includes behavior tests and the corresponding coverage-table update.
Use `stacked-pr` to maintain dependent branches and `prepare-issue-pr` when
publishing each draft PR. Run the applicable checks before advancing a layer.

## Completion

All four existing-annotation layers are implemented. Tests cover contextual
neighbors, joint jukugo bounds, cluster-aligned reading conservation, continuation
state identity, and annotation collisions. The coverage table continues to mark
full appendix F spacing distributions and reference structures requiring new
semantic inputs as partial or deferred. Those are distinct from the selected behavior implemented here.

## Contextual boundary follow-up

The supported cl-22/cl-23 pair-table cells and line edges now resolve spacing
and break rules from ruby membership. Shared group and jukugo interiors exclude ordinary pair
adjustment even when they may split. Overhang covers authored ideographic spaces
and uses adjusted half/quarter-space limits. Value-dependent cl-08 binding preserves
identical repetitions and the two kana-repeat upper/lower pairs, while unlike
marks may break and expand. Public contracts and persisted settings are unchanged.

## Extension boundary

Sidelines, selectable annotation sides, and mixed body sizes remain deferred.
Their future input belongs in parser-produced semantic annotations, with placement
owned by core. The initial size choices will be 0.75, 1, and 1.25 times body size.
Body pitch stays fixed; combinations that cannot fit the selected annotation
area are refused. Add public variants, notation, UI, and persistence only when
a concrete feature needs them. Real shaping, horizontal text, warichu, and
formulas are separate work.
