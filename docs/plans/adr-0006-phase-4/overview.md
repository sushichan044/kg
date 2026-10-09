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

## Extension boundary

Sidelines, selectable annotation sides, and mixed body sizes remain deferred.
Their future input belongs in parser-produced semantic annotations, with placement
owned by core. The initial size choices will be 0.75, 1, and 1.25 times body size.
Body pitch stays fixed; combinations that cannot fit the selected annotation
area are refused. Add public variants, notation, UI, and persistence only when
a concrete feature needs them. Real shaping, horizontal text, warichu, and
formulas are separate work.
